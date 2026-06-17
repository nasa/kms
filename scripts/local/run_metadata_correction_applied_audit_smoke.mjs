#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Local end-to-end audit smoke for metadata correction.
 *
 * This script exercises the real metadataCorrectionService handler against:
 * - the local mock CMR server
 * - local Redis keyword caches
 * - local RDF4J audit persistence
 *
 * It verifies that a successful correction run writes both audit lifecycle states:
 * - `pending` before writeback
 * - `applied` after writeback succeeds
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_metadata_correction_applied_audit_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)
const outputDir = path.resolve(rootDir, 'tmp/metadata-correction-audit-smoke')
const outputPath = path.resolve(outputDir, 'result.json')
const port = Number(process.env.MOCK_CMR_PORT || 3020)
const baseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${port}`
const startMockServer = String(process.env.START_MOCK_CMR || 'true').toLowerCase() !== 'false'

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const collection = fixture.cmr.collections[0]
const rawKeywordEvent = fixture.keywordEvents[0]
const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || collection.conceptId
const providerId = process.env.PROVIDER_ID || collection.providerId

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

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

const buildCacheResponse = (responseBody) => ({
  statusCode: 200,
  body: JSON.stringify(responseBody)
})

const normalizeKeywordEvent = (keywordEvent) => ({
  eventType: keywordEvent.EventType,
  scheme: keywordEvent.Scheme,
  uuid: keywordEvent.UUID,
  oldKeywordObject: keywordEvent.OldKeywordObject,
  newKeywordObject: keywordEvent.NewKeywordObject
})

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
    throw new Error('Unable to connect to Redis for metadata correction audit smoke seeding.')
  }

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

  const { metadataCorrectionService } = await import('../../serverless/src/metadataCorrectionService/handler')
  const { getMetadataCorrectionAuditLog } = await import('../../serverless/src/shared/getMetadataCorrectionAuditLog')

  const beforeRows = await getMetadataCorrectionAuditLog({
    collectionConceptId,
    limit: 20
  })

  await metadataCorrectionService({
    Records: [
      {
        messageId: 'local-audit-smoke-1',
        body: JSON.stringify({
          source: 'local-smoke',
          collectionConceptId,
          keywordEvent: normalizeKeywordEvent(rawKeywordEvent)
        })
      }
    ]
  })

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
    beforeCount: beforeRows.length,
    afterCount: afterRows.length,
    statuses,
    rows: afterRows
  }, null, 2), 'utf8')

  console.log('[metadata-correction-audit-smoke] Completed successfully')
  console.log(JSON.stringify({
    collectionConceptId,
    providerId,
    baseUrl,
    beforeCount: beforeRows.length,
    afterCount: afterRows.length,
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
