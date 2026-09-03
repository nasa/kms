#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { closeDocumentDbClient } from '../../serverless/src/shared/documentDbClient'

/**
 * Local end-to-end smoke for the queued manual-request delay path.
 *
 * This smoke drives the real `metadataCorrectionService` handler with an
 * SQS-like record shaped like the new async API publishes:
 * - source=metadataCorrectionApi
 * - collectionConceptId present
 * - requestedAt stamped near "now"
 *
 * It verifies the consumer waits for the configured delay window before
 * running correction, then confirms the correction still completes and writes
 * the expected metadata change through the mock CMR path.
 *
 * Prerequisites:
 * - local Redis is running
 * - local MongoDB-compatible audit storage is running
 * - LocalStack is optional; if present, set AWS_ENDPOINT_URL to avoid metric
 *   emission errors in logs
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_metadata_correction_request_delay_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)
const outputDir = path.resolve(rootDir, 'tmp/metadata-correction-request-delay-smoke')
const outputPath = path.resolve(outputDir, 'result.json')
const mockCmrPort = Number(process.env.MOCK_CMR_PORT || 3020)
const startMockServer = String(process.env.START_MOCK_CMR || 'true').toLowerCase() !== 'false'
const cmrBaseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${mockCmrPort}`
const configuredDelayMs = Number(process.env.METADATA_CORRECTION_REQUEST_DELAY_MS || '2000')
const delayAssertionToleranceMs = Number(process.env.DELAY_ASSERTION_TOLERANCE_MS || '250')

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
    throw new Error('Unable to connect to Redis for metadata correction delay smoke seeding.')
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
 * Removes any existing audit documents for the smoke collection so assertions start clean.
 *
 * @returns {Promise<void>} Resolves once prior audit documents have been deleted.
 */
const clearAuditRowsForCollection = async () => {
  process.env.DOCUMENTDB_URI = process.env.DOCUMENTDB_URI
    || `mongodb://localhost:${process.env.DOCUMENTDB_HOST_PORT || 27018}`
  const { getMetadataCorrectionAuditCollection } = await import(
    '../../serverless/src/shared/documentDbClient'
  )
  const auditCollection = await getMetadataCorrectionAuditCollection()

  await auditCollection.deleteMany({ collectionConceptId })
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
          MOCK_CMR_PORT: String(mockCmrPort)
        },
        stdio: 'inherit'
      }
    )

    await waitForHealth(`${cmrBaseUrl}/health`)
  }

  process.env.CMR_BASE_URL = cmrBaseUrl
  process.env.CMR_WRITEBACK_PROVIDERS = process.env.CMR_WRITEBACK_PROVIDERS || providerId
  process.env.CMR_WRITER_TOKEN = process.env.CMR_WRITER_TOKEN || 'Bearer local-writer-token'
  process.env.METADATA_CORRECTION_REQUEST_DELAY_MS = String(configuredDelayMs)
  process.env.AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || 'http://127.0.0.1:4566'

  redisClient = await seedKeywordCaches()
  await clearAuditRowsForCollection()

  const { metadataCorrectionService } = await import('../../serverless/src/metadataCorrectionService/handler')
  const { getMetadataCorrectionAuditLog } = await import('../../serverless/src/shared/getMetadataCorrectionAuditLog')
  const { getCmrCollectionNativeMetadata } = await import('../../serverless/src/shared/getCmrCollectionNativeMetadata')

  const requestedAt = new Date().toISOString()
  const startedAtMs = Date.now()

  const response = await metadataCorrectionService({
    Records: [
      {
        messageId: 'local-request-delay-smoke-1',
        body: JSON.stringify({
          source: 'metadataCorrectionApi',
          requestedAt,
          collectionConceptId
        })
      }
    ]
  })

  const finishedAtMs = Date.now()
  const elapsedMs = finishedAtMs - startedAtMs
  const minimumExpectedElapsedMs = configuredDelayMs - delayAssertionToleranceMs

  if (elapsedMs < minimumExpectedElapsedMs) {
    throw new Error(
      'Expected metadata correction service to honor the configured request delay. '
      + `ConfiguredDelayMs=${configuredDelayMs} `
      + `ToleranceMs=${delayAssertionToleranceMs} `
      + `ElapsedMs=${elapsedMs}`
    )
  }

  if (response?.batchItemFailures?.length !== 0) {
    throw new Error(
      `Expected no batch item failures, received ${JSON.stringify(response.batchItemFailures)}`
    )
  }

  const updatedNativeMetadata = await getCmrCollectionNativeMetadata({
    collectionConceptId
  })
  const updatedPlatform = updatedNativeMetadata?.Platforms?.[0]

  if (!updatedPlatform) {
    throw new Error(`Expected updated UMM Platforms[0] for ${collectionConceptId}`)
  }

  if (updatedPlatform.ShortName !== 'Aqua') {
    throw new Error(
      'Expected corrected UMM Platforms[0].ShortName to be Aqua, '
      + `received ${updatedPlatform.ShortName}`
    )
  }

  if (updatedPlatform?.Instruments?.[0]?.ShortName !== 'Legacy MODIS') {
    throw new Error(
      'Expected corrected UMM Platforms[0].Instruments[0].ShortName to remain Legacy MODIS'
    )
  }

  const { items: auditRows } = await getMetadataCorrectionAuditLog({
    collectionConceptId,
    limit: 20
  })
  const statuses = [...new Set(auditRows.flatMap((row) => (
    row.statusHistory?.map(({ status }) => status) || [row.status]
  )))]

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
    cmrBaseUrl,
    configuredDelayMs,
    delayAssertionToleranceMs,
    requestedAt,
    startedAtMs,
    finishedAtMs,
    elapsedMs,
    statuses,
    updatedPlatform,
    response,
    rows: auditRows
  }, null, 2), 'utf8')

  console.log('[metadata-correction-request-delay-smoke] Completed successfully')
  console.log(JSON.stringify({
    collectionConceptId,
    providerId,
    configuredDelayMs,
    delayAssertionToleranceMs,
    elapsedMs,
    statuses,
    outputPath
  }, null, 2))
} finally {
  await closeDocumentDbClient()

  if (redisClient) {
    await redisClient.quit()
  }

  if (mockServerProcess) {
    mockServerProcess.kill('SIGTERM')
  }
}
