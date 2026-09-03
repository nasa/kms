#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { closeDocumentDbClient } from '../../serverless/src/shared/documentDbClient'

/**
 * Local end-to-end audit smoke for failed metadata-correction writeback.
 *
 * This script exercises the real metadataCorrectionService handler against:
 * - the local mock CMR server, configured to fail ingest/writeback
 * - local Redis keyword caches
 * - local MongoDB-compatible DocumentDB audit persistence
 *
 * It verifies that a failed correction run writes:
 * - `pending` before writeback
 * - `failed` after CMR ingest rejects the corrected metadata
 * - structured error details on the failed audit document
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_metadata_correction_failed_audit_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)
const outputDir = path.resolve(rootDir, 'tmp/metadata-correction-failed-audit-smoke')
const outputPath = path.resolve(outputDir, 'result.json')
const port = Number(process.env.MOCK_CMR_PORT || 3020)
const baseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${port}`
const startMockServer = String(process.env.START_MOCK_CMR || 'true').toLowerCase() !== 'false'
const mockIngestErrorStatus = Number(process.env.MOCK_CMR_INGEST_ERROR_STATUS || 400)
const mockIngestErrorBody = process.env.MOCK_CMR_INGEST_ERROR_BODY
  || JSON.stringify({
    errors: ['Mock CMR ingest validation failure.']
  })

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const collection = fixture.cmr.collections[0]
const rawKeywordEvent = fixture.keywordEvents[0]
const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || collection.conceptId
const providerId = process.env.PROVIDER_ID || collection.providerId
const messageId = 'local-failed-audit-smoke-1'

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
    throw new Error('Unable to connect to Redis for metadata correction failed audit smoke seeding.')
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

/**
 * Removes prior audit documents for the smoke collection so assertions start from a clean state.
 *
 * @returns {Promise<void>} Resolves after matching local audit documents are deleted.
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
          MOCK_CMR_PORT: String(port),
          MOCK_CMR_INGEST_ERROR_STATUS: String(mockIngestErrorStatus),
          MOCK_CMR_INGEST_ERROR_BODY: mockIngestErrorBody
        },
        stdio: 'inherit'
      }
    )

    await waitForHealth(`${baseUrl}/health`)
  }

  process.env.CMR_BASE_URL = baseUrl
  process.env.CMR_WRITEBACK_PROVIDERS = process.env.CMR_WRITEBACK_PROVIDERS || providerId
  process.env.CMR_WRITER_TOKEN = process.env.CMR_WRITER_TOKEN || 'Bearer local-writer-token'

  redisClient = await seedKeywordCaches()
  await clearAuditRowsForCollection()

  const { metadataCorrectionService } = await import('../../serverless/src/metadataCorrectionService/handler')
  const { getMetadataCorrectionAuditLog } = await import('../../serverless/src/shared/getMetadataCorrectionAuditLog')

  const { items: beforeRows } = await getMetadataCorrectionAuditLog({
    collectionConceptId,
    limit: 20
  })

  const response = await metadataCorrectionService({
    Records: [
      {
        messageId,
        body: JSON.stringify({
          source: 'local-smoke',
          collectionConceptId,
          keywordEvent: normalizeKeywordEvent(rawKeywordEvent)
        })
      }
    ]
  })

  const { items: afterRows } = await getMetadataCorrectionAuditLog({
    collectionConceptId,
    limit: 20
  })
  const statuses = [...new Set(afterRows.flatMap((row) => (
    row.statusHistory?.map(({ status }) => status) || [row.status]
  )))]
  const failedRow = afterRows.find((row) => row.status === 'failed')

  if (beforeRows.length !== 0) {
    throw new Error(`Expected no starting audit documents for ${collectionConceptId}, found ${beforeRows.length}`)
  }

  if (JSON.stringify(response?.batchItemFailures) !== JSON.stringify([
    { itemIdentifier: messageId }
  ])) {
    throw new Error(
      'Expected the failed messageId in batchItemFailures. '
      + `Received ${JSON.stringify(response?.batchItemFailures)}`
    )
  }

  if (!statuses.includes('pending')) {
    throw new Error(`Missing pending audit status for ${collectionConceptId}`)
  }

  if (!statuses.includes('failed')) {
    throw new Error(`Missing failed audit status for ${collectionConceptId}`)
  }

  if (statuses.includes('applied')) {
    throw new Error(`Did not expect applied audit status for failed writeback on ${collectionConceptId}`)
  }

  if (!failedRow?.error?.message) {
    throw new Error(`Missing error details on failed audit document for ${collectionConceptId}`)
  }

  if (JSON.stringify(failedRow.error.cmrResponseBody) !== mockIngestErrorBody) {
    throw new Error(
      'Expected failed audit response details to match the mock ingest response body. '
      + `Received ${JSON.stringify(failedRow.error.cmrResponseBody)}`
    )
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify({
    collectionConceptId,
    providerId,
    baseUrl,
    beforeCount: beforeRows.length,
    afterCount: afterRows.length,
    response,
    statuses,
    failedRow,
    outputPath
  }, null, 2), 'utf8')

  console.log('[metadata-correction-failed-audit-smoke] Completed successfully')
  console.log(JSON.stringify({
    collectionConceptId,
    providerId,
    baseUrl,
    afterCount: afterRows.length,
    statuses,
    failedWritebackErrorMessage: failedRow.error.message,
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
