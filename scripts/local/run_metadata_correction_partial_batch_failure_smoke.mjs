#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Local end-to-end smoke for metadata-correction consumer partial batch failure handling.
 *
 * This smoke drives the real `metadataCorrectionService` handler with a two-record SQS-like
 * batch:
 * - one valid collection correction request that should complete successfully
 * - one invalid JSON body that should be returned in `batchItemFailures`
 *
 * What this proves:
 * - successful records still run correction/writeback normally
 * - failed records are surfaced by messageId in the AWS partial batch response shape
 * - the consumer no longer needs to fail the whole invocation to retry only the bad message
 *
 * Prerequisites:
 * - local Redis is running
 * - LocalStack is optional; if present, set AWS_ENDPOINT_URL to avoid metric emission errors
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_metadata_correction_partial_batch_failure_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)
const outputDir = path.resolve(rootDir, 'tmp/metadata-correction-partial-batch-failure-smoke')
const outputPath = path.resolve(outputDir, 'result.json')
const mockCmrPort = Number(process.env.MOCK_CMR_PORT || 3020)
const startMockServer = String(process.env.START_MOCK_CMR || 'true').toLowerCase() !== 'false'
const cmrBaseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${mockCmrPort}`

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const collection = fixture.cmr.collections[0]
const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || collection.conceptId
const providerId = process.env.PROVIDER_ID || collection.providerId
const successfulMessageId = 'local-partial-batch-success'
const failedMessageId = 'local-partial-batch-failure'

/**
 * Sleeps for a short interval while the smoke waits on local dependencies.
 *
 * @param {number} ms Milliseconds to pause.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

/**
 * Polls the mock CMR health endpoint until it becomes reachable.
 *
 * @param {string} healthUrl Mock server health-check URL.
 * @param {number} [attempt=1] Current poll attempt count.
 * @returns {Promise<void>}
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
 * @returns {{statusCode: number, body: string}}
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
    throw new Error('Unable to connect to Redis for metadata correction partial batch smoke seeding.')
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
  process.env.CMR_WRITER_TOKEN = process.env.CMR_WRITER_TOKEN || 'local-writer-token'
  process.env.AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || 'http://127.0.0.1:4566'
  process.env.RDF4J_SERVICE_URL = process.env.RDF4J_SERVICE_URL || 'http://localhost:8081'
  process.env.RDF4J_USER_NAME = process.env.RDF4J_USER_NAME || 'rdf4j'
  process.env.RDF4J_PASSWORD = process.env.RDF4J_PASSWORD || 'rdf4j'

  redisClient = await seedKeywordCaches()

  const { metadataCorrectionService } = await import('../../serverless/src/metadataCorrectionService/handler')
  const { getCmrCollectionNativeMetadata } = await import('../../serverless/src/shared/getCmrCollectionNativeMetadata')

  const response = await metadataCorrectionService({
    Records: [
      {
        messageId: successfulMessageId,
        body: JSON.stringify({
          collectionConceptId
        })
      },
      {
        messageId: failedMessageId,
        body: 'not-json'
      }
    ]
  })

  if (JSON.stringify(response?.batchItemFailures) !== JSON.stringify([
    { itemIdentifier: failedMessageId }
  ])) {
    throw new Error(
      'Expected only the bad record messageId in batchItemFailures. '
      + `Received ${JSON.stringify(response?.batchItemFailures)}`
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

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify({
    collectionConceptId,
    providerId,
    successfulMessageId,
    failedMessageId,
    response,
    updatedPlatform,
    outputPath
  }, null, 2), 'utf8')

  console.log('[metadata-correction-partial-batch-failure-smoke] Completed successfully')
  console.log(JSON.stringify({
    collectionConceptId,
    successfulMessageId,
    failedMessageId,
    batchItemFailures: response.batchItemFailures,
    updatedPlatformShortName: updatedPlatform.ShortName,
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
