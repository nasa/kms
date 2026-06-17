#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Local end-to-end smoke for the synchronous metadata-correction endpoint.
 *
 * This smoke test drives the new `runMetadataCorrection` API handler directly with an
 * API-Gateway-like event. It uses the checked-in mock CMR fixture plus local Redis/RDF4J so
 * the full correction path runs end to end:
 * - fetch collection UMM/native metadata from the mock CMR server
 * - validate keyword problems against the seeded Redis caches
 * - resolve corrections
 * - apply the UMM delegate
 * - persist audit rows
 * - write the corrected metadata back to the mock CMR ingest route
 *
 * The checked-in fixture currently resolves a `platforms` correction from
 * `Aqua Legacy` -> `Aqua`, so the verification below asserts that specific
 * replacement made it all the way through the sync endpoint and mock writeback.
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_metadata_correction_sync_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)
const outputDir = path.resolve(rootDir, 'tmp/metadata-correction-sync-smoke')
const outputPath = path.resolve(outputDir, 'result.json')
const port = Number(process.env.MOCK_CMR_PORT || 3020)
const baseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${port}`
const startMockServer = String(process.env.START_MOCK_CMR || 'true').toLowerCase() !== 'false'

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const collection = fixture.cmr.collections[0]
const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || collection.conceptId
const providerId = process.env.PROVIDER_ID || collection.providerId

/**
 * Sleeps for a short interval while the smoke waits on local dependencies.
 *
 * @param {number} ms Milliseconds to pause.
 * @returns {Promise<void>} Promise that resolves after the delay.
 */
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

/**
 * Polls the mock CMR health endpoint until it becomes reachable.
 *
 * @param {string} healthUrl Mock server health-check URL.
 * @param {number} [attempt=1] Current poll attempt count.
 * @returns {Promise<void>} Resolves once the mock server is healthy.
 */
const waitForHealth = async (healthUrl, attempt = 1) => {
  try {
    const response = await fetch(healthUrl)

    if (response.ok) {
      return
    }
  } catch {
    // Keep polling until the child server comes up.
  }

  if (attempt >= 40) {
    throw new Error(`Timed out waiting for mock CMR health endpoint: ${healthUrl}`)
  }

  await sleep(250)
  await waitForHealth(healthUrl, attempt + 1)
}

/**
 * Wraps cached concept payloads in the same API-response envelope stored in Redis.
 *
 * @param {object} responseBody Cached concept response body.
 * @returns {{statusCode: number, body: string}} Serialized cache entry payload.
 */
const buildCacheResponse = (responseBody) => ({
  statusCode: 200,
  body: JSON.stringify(responseBody)
})

/**
 * Seeds the local Redis caches with the historical and published keyword fixtures.
 *
 * @returns {Promise<object>} Connected Redis client for later cleanup.
 */
const seedKeywordCaches = async () => {
  process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'true'
  process.env.REDIS_HOST = process.env.REDIS_HOST_SERVICE_HOST || process.env.REDIS_HOST || 'localhost'
  process.env.REDIS_PORT = process.env.REDIS_HOST_PORT || process.env.REDIS_PORT || '6380'
  process.env.REDIS_FAIL_FAST = process.env.REDIS_FAIL_FAST || 'true'

  const {
    createConceptResponseCacheKeyByFullPath,
    createConceptResponseCacheKeyByShortName,
    createPublishedConceptResponseCacheKeyByFullPath,
    createPublishedConceptResponseCacheKeyByShortName,
    createPublishedConceptResponseCacheKeyByUuid
  } = await import('../../serverless/src/shared/redisCacheKeys')
  const { getRedisClient } = await import('../../serverless/src/shared/redisCacheStore')

  const redisClient = await getRedisClient()

  if (!redisClient) {
    throw new Error('Unable to connect to Redis for metadata correction sync smoke seeding.')
  }

  /**
   * Seeds one set of fixture concepts into the appropriate Redis key-space.
   *
   * @param {object} params Seeding parameters.
   * @param {Array<object>} params.concepts Historical or published concept fixtures.
   * @param {Function} params.createFullPathCacheKey Cache-key builder for full-path lookups.
   * @param {Function} params.createShortNameCacheKey Cache-key builder for short-name lookups.
   * @param {Function} [params.createUuidCacheKey] Optional cache-key builder for UUID lookups.
   * @returns {Promise<void[]>} Resolves once the provided concept set is seeded.
   */
  const seedConcepts = async ({
    concepts,
    createFullPathCacheKey,
    createShortNameCacheKey,
    createUuidCacheKey
  }) => Promise.all(concepts.map(async (concept) => {
    const {
      lookupType,
      responseBody,
      scheme
    } = concept

    let cacheKey

    if (lookupType === 'fullPath') {
      cacheKey = createFullPathCacheKey({
        fullPath: concept.fullPath.toLowerCase(),
        scheme: scheme.toLowerCase()
      })
    } else {
      cacheKey = createShortNameCacheKey({
        shortName: concept.shortName.toLowerCase(),
        scheme: scheme.toLowerCase()
      })
    }

    await redisClient.set(cacheKey, JSON.stringify(buildCacheResponse(responseBody)))

    if (createUuidCacheKey) {
      const uuidCacheKey = createUuidCacheKey({
        uuid: responseBody.uuid.toLowerCase(),
        scheme: scheme.toLowerCase()
      })

      await redisClient.set(uuidCacheKey, JSON.stringify(buildCacheResponse(responseBody)))
    }
  }))

  await seedConcepts({
    concepts: fixture.historicalConcepts || [],
    createFullPathCacheKey: createConceptResponseCacheKeyByFullPath,
    createShortNameCacheKey: createConceptResponseCacheKeyByShortName
  })

  await seedConcepts({
    concepts: fixture.publishedConcepts || [],
    createFullPathCacheKey: createPublishedConceptResponseCacheKeyByFullPath,
    createShortNameCacheKey: createPublishedConceptResponseCacheKeyByShortName,
    createUuidCacheKey: createPublishedConceptResponseCacheKeyByUuid
  })

  return redisClient
}

/**
 * Removes any existing audit rows for the smoke collection so assertions start clean.
 *
 * @returns {Promise<void>} Resolves once prior audit rows have been deleted.
 */
const clearAuditRowsForCollection = async () => {
  process.env.RDF4J_SERVICE_URL = process.env.RDF4J_SERVICE_URL || 'http://localhost:8081'
  process.env.RDF4J_USER_NAME = process.env.RDF4J_USER_NAME || 'rdf4j'
  process.env.RDF4J_PASSWORD = process.env.RDF4J_PASSWORD || 'rdf4j'

  const {
    escapeSparqlLiteral,
    METADATA_CORRECTION_AUDIT_GRAPH
  } = await import('../../serverless/src/shared/metadataCorrectionAudit')
  const { sparqlRequest } = await import('../../serverless/src/shared/sparqlRequest')

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>

    DELETE {
      GRAPH <${METADATA_CORRECTION_AUDIT_GRAPH}> {
        ?record ?predicate ?object .
      }
    }
    WHERE {
      GRAPH <${METADATA_CORRECTION_AUDIT_GRAPH}> {
        ?record a gcmd:MetadataCorrectionAuditRecord ;
                gcmd:collectionConceptId "${escapeSparqlLiteral(collectionConceptId)}" ;
                ?predicate ?object .
      }
    }
  `

  await sparqlRequest({
    method: 'POST',
    contentType: 'application/sparql-update',
    accept: 'application/json',
    body: query
  })
}

let mockServerProcess
let redisClient

try {
  if (startMockServer) {
    mockServerProcess = spawn(
      process.execPath,
      [path.resolve(rootDir, 'scripts/local/mock_cmr_server.mjs'), fixturePath],
      {
        env: {
          ...process.env,
          FIXTURE_FILE: fixturePath,
          MOCK_CMR_PORT: String(port)
        },
        stdio: 'inherit'
      }
    )

    await waitForHealth(`${baseUrl}/health`)
  }

  process.env.CMR_BASE_URL = baseUrl
  process.env.CMR_WRITEBACK_PROVIDERS = process.env.CMR_WRITEBACK_PROVIDERS || providerId
  process.env.CMR_WRITER_TOKEN = process.env.CMR_WRITER_TOKEN || 'local-writer-token'

  redisClient = await seedKeywordCaches()
  await clearAuditRowsForCollection()

  const { runMetadataCorrection } = await import('../../serverless/src/runMetadataCorrection/handler')
  const { getMetadataCorrectionAuditLog } = await import('../../serverless/src/shared/getMetadataCorrectionAuditLog')
  const { getCmrCollectionNativeMetadata } = await import('../../serverless/src/shared/getCmrCollectionNativeMetadata')

  const beforeRows = await getMetadataCorrectionAuditLog({
    collectionConceptId,
    limit: 20
  })

  const response = await runMetadataCorrection({
    pathParameters: {
      collectionConceptId
    }
  })

  if (response.statusCode !== 200) {
    throw new Error(`Expected 200 response from runMetadataCorrection, received ${response.statusCode}: ${response.body}`)
  }

  const responseBody = JSON.parse(response.body)

  if (responseBody.outcome !== 'processed') {
    throw new Error(`Expected processed outcome for ${collectionConceptId}, received ${responseBody.outcome}`)
  }

  if (responseBody.collectionConceptId !== collectionConceptId) {
    throw new Error(`Expected response collectionConceptId=${collectionConceptId}, received ${responseBody.collectionConceptId}`)
  }

  if (responseBody.nativeFormat !== 'UMM') {
    throw new Error(`Expected nativeFormat=UMM for sync smoke fixture, received ${responseBody.nativeFormat}`)
  }

  if (responseBody.keywordValidationFailureCount < 1) {
    throw new Error(`Expected at least one keyword validation failure for ${collectionConceptId}`)
  }

  if (responseBody.resolvedCorrectionCount < 1) {
    throw new Error(`Expected at least one resolved correction for ${collectionConceptId}`)
  }

  if ((responseBody.correctionResult?.correctionCount || 0) < 1) {
    throw new Error(`Expected at least one applied correction for ${collectionConceptId}`)
  }

  if (responseBody.writeResult?.ingestResult?.updated !== true) {
    throw new Error(`Expected successful mock CMR writeback for ${collectionConceptId}`)
  }

  if ((responseBody.auditResults?.pending?.insertedCount || 0) < 1) {
    throw new Error(`Expected pending audit rows for ${collectionConceptId}`)
  }

  if ((responseBody.auditResults?.applied?.insertedCount || 0) < 1) {
    throw new Error(`Expected applied audit rows for ${collectionConceptId}`)
  }

  const resolvedCorrection = responseBody.resolvedCorrections[0]

  if (resolvedCorrection?.scheme !== 'platforms') {
    throw new Error(`Expected first resolved correction scheme=platforms, received ${resolvedCorrection?.scheme}`)
  }

  if (resolvedCorrection?.oldKeywordObject?.ShortName !== 'Aqua Legacy') {
    throw new Error('Expected resolved correction oldKeywordObject.ShortName to be Aqua Legacy')
  }

  if (resolvedCorrection?.newKeywordObject?.ShortName !== 'Aqua') {
    throw new Error('Expected resolved correction newKeywordObject.ShortName to be Aqua')
  }

  const updatedNativeMetadata = await getCmrCollectionNativeMetadata({
    collectionConceptId
  })

  const updatedPlatform = updatedNativeMetadata?.Platforms?.[0]

  if (!updatedPlatform) {
    throw new Error(`Expected updated UMM Platforms[0] for ${collectionConceptId}`)
  }

  if (updatedPlatform.ShortName !== 'Aqua') {
    throw new Error(`Expected corrected UMM Platforms[0].ShortName to be Aqua, received ${updatedPlatform.ShortName}`)
  }

  if (updatedPlatform?.Instruments?.[0]?.ShortName !== 'Legacy MODIS') {
    throw new Error('Expected corrected UMM Platforms[0].Instruments[0].ShortName to remain Legacy MODIS')
  }

  const afterRows = await getMetadataCorrectionAuditLog({
    collectionConceptId,
    limit: 20
  })
  const statuses = [...new Set(afterRows.map((row) => row.status))]

  if (beforeRows.length !== 0) {
    throw new Error(`Expected no starting audit rows for ${collectionConceptId}, found ${beforeRows.length}`)
  }

  if (!statuses.includes('pending')) {
    throw new Error(`Missing pending audit status for ${collectionConceptId}`)
  }

  if (!statuses.includes('applied')) {
    throw new Error(`Missing applied audit status for ${collectionConceptId}`)
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify({
    collectionConceptId,
    providerId,
    baseUrl,
    responseBody,
    updatedPlatform,
    beforeCount: beforeRows.length,
    afterCount: afterRows.length,
    statuses,
    rows: afterRows
  }, null, 2), 'utf8')

  console.log('[metadata-correction-sync-smoke] Completed successfully')
  console.log(JSON.stringify({
    collectionConceptId,
    providerId,
    baseUrl,
    keywordValidationFailureCount: responseBody.keywordValidationFailureCount,
    keywordValidationFailures: responseBody.keywordValidationFailures,
    resolvedCorrectionCount: responseBody.resolvedCorrectionCount,
    resolvedCorrections: responseBody.resolvedCorrections,
    correctionCount: responseBody.correctionResult?.correctionCount || 0,
    resolvedScheme: resolvedCorrection.scheme,
    statuses,
    outputPath
  }, null, 2))
} finally {
  if (redisClient) {
    await redisClient.quit()
  }

  if (mockServerProcess) {
    mockServerProcess.kill('SIGTERM')
  }
}
