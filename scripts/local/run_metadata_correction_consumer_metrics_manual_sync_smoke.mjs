#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  CONSUMER_METRIC_NAMES,
  CONSUMER_METRIC_NAMESPACE
} from '../../serverless/src/shared/emitConsumerMetrics'

/**
 * Local end-to-end smoke for manual sync consumer metrics.
 *
 * This smoke test drives the real `runMetadataCorrection` API handler with an
 * API-Gateway-like event, verifies the collection was corrected through the
 * mock CMR writeback path, and then checks LocalStack CloudWatch to confirm
 * the expected consumer metrics incremented in the `CMR/KeywordSync`
 * namespace for the manual single-collection flow.
 *
 * Prerequisites:
 * - LocalStack is running and reachable on `AWS_ENDPOINT_URL` or `http://localhost:4566`
 * - local Redis is running
 * - local RDF4J is running
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_metadata_correction_consumer_metrics_manual_sync_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/metadata_correction_smoke.full_path.example.json'
)
const outputDir = path.resolve(rootDir, 'tmp/metadata-correction-consumer-metrics-manual-sync-smoke')
const outputPath = path.resolve(outputDir, 'result.json')
const mockCmrPort = Number(process.env.MOCK_CMR_PORT || 3020)
const cmrBaseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${mockCmrPort}`
const cloudWatchEndpoint = process.env.AWS_ENDPOINT_URL || 'http://127.0.0.1:4566'
const startMockServer = String(process.env.START_MOCK_CMR || 'true').toLowerCase() !== 'false'
const cloudWatchApiVersion = '2010-08-01'
const metricNamespace = CONSUMER_METRIC_NAMESPACE
const metricPeriodSeconds = 60

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const collection = fixture.cmr.collections[0]
const collectionConceptId = process.env.COLLECTION_CONCEPT_ID || collection.conceptId
const providerId = process.env.PROVIDER_ID || collection.providerId
const measurementWindowStart = new Date(Date.now() - (10 * 60 * 1000)).toISOString()

/**
 * Sleeps for a short interval while polling local dependencies.
 *
 * @param {number} ms Milliseconds to pause.
 * @returns {Promise<void>} Resolves after the delay.
 */
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

/**
 * Waits for an HTTP health endpoint to begin returning 200 responses.
 *
 * @param {string} healthUrl Health-check URL to poll.
 * @param {number} [attempt=1] Current retry attempt.
 * @returns {Promise<void>} Resolves when the endpoint becomes healthy.
 */
const waitForHealth = async (healthUrl, attempt = 1) => {
  try {
    const response = await fetch(healthUrl)

    if (response.ok) {
      return
    }
  } catch {
    // Keep polling until the dependency is reachable.
  }

  if (attempt >= 40) {
    throw new Error(`Timed out waiting for health endpoint: ${healthUrl}`)
  }

  await sleep(250)
  await waitForHealth(healthUrl, attempt + 1)
}

/**
 * Wraps cached concept payloads in the Redis response envelope used locally.
 *
 * @param {object} responseBody Cached concept response body.
 * @returns {{statusCode: number, body: string}} Serialized Redis cache entry.
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
    throw new Error('Unable to connect to Redis for manual sync consumer metrics smoke seeding.')
  }

  /**
   * Seeds one set of fixture concepts into the appropriate Redis key-space.
   *
   * @param {object} params Seeding parameters.
   * @param {Array<object>} params.concepts Historical or published concept fixtures.
   * @param {Function} params.createFullPathCacheKey Full-path cache-key builder.
   * @param {Function} params.createShortNameCacheKey Short-name cache-key builder.
   * @param {Function} [params.createUuidCacheKey] Optional UUID cache-key builder.
   * @returns {Promise<void[]>} Resolves once the concepts are seeded.
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
 * Removes any existing audit rows for the smoke collection.
 *
 * @returns {Promise<void>} Resolves once prior audit rows are deleted.
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

/**
 * Creates an XML parser for CloudWatch Query API responses.
 *
 * @returns {Promise<object>} XML parser instance.
 */
const createParser = async () => {
  const { XMLParser } = await import('fast-xml-parser')

  return new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true
  })
}

/**
 * Normalizes an optional list value into an array.
 *
 * @param {unknown} value Candidate scalar-or-array value.
 * @returns {Array<unknown>} Array representation.
 */
const toArray = (value) => {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

/**
 * Posts a CloudWatch Query API request to LocalStack.
 *
 * @param {object} params Query request parameters.
 * @param {string} params.endpoint LocalStack CloudWatch endpoint.
 * @param {object} params.queryParams Query string parameters for the CloudWatch API call.
 * @returns {Promise<string>} Raw XML response body.
 */
const postCloudWatchQuery = async ({
  endpoint,
  queryParams
}) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    },
    body: new URLSearchParams(queryParams).toString()
  })

  if (!response.ok) {
    const responseBody = await response.text()

    throw new Error(
      `CloudWatch query failed. Status=${response.status}. Response=${responseBody}`
    )
  }

  return response.text()
}

/**
 * Waits for the LocalStack CloudWatch Query API to begin responding successfully.
 *
 * @param {object} params Probe parameters.
 * @param {string} params.endpoint LocalStack CloudWatch endpoint.
 * @param {number} [params.attempt=1] Current retry attempt.
 * @returns {Promise<void>} Resolves once LocalStack CloudWatch is reachable.
 */
const waitForCloudWatch = async ({
  endpoint,
  attempt = 1
}) => {
  try {
    await postCloudWatchQuery({
      endpoint,
      queryParams: {
        Action: 'ListMetrics',
        Version: cloudWatchApiVersion,
        Namespace: metricNamespace
      }
    })

    return
  } catch {
    // Keep polling until the LocalStack CloudWatch query API is reachable.
  }

  if (attempt >= 40) {
    throw new Error(`Timed out waiting for LocalStack CloudWatch endpoint: ${endpoint}`)
  }

  await sleep(250)
  await waitForCloudWatch({
    endpoint,
    attempt: attempt + 1
  })
}

/**
 * Reads all datapoints for one metric in the smoke's measurement window.
 *
 * @param {object} params Metric query parameters.
 * @param {string} params.endpoint LocalStack CloudWatch endpoint.
 * @param {string} params.metricName CloudWatch metric name.
 * @param {string} params.startTime ISO start time for the smoke window.
 * @param {string} params.endTime ISO end time for the smoke window.
 * @param {object} params.parser XML parser instance.
 * @returns {Promise<Array<{timestamp: string, value: number}>>} Parsed metric datapoints.
 */
const getMetricDatapoints = async ({
  endpoint,
  metricName,
  startTime,
  endTime,
  parser
}) => {
  const responseXml = await postCloudWatchQuery({
    endpoint,
    queryParams: {
      Action: 'GetMetricStatistics',
      Version: cloudWatchApiVersion,
      Namespace: metricNamespace,
      MetricName: metricName,
      StartTime: startTime,
      EndTime: endTime,
      Period: String(metricPeriodSeconds),
      'Statistics.member.1': 'Sum'
    }
  })

  const result = parser.parse(responseXml)
  const datapoints = toArray(
    result?.GetMetricStatisticsResponse?.GetMetricStatisticsResult?.Datapoints?.member
  )

  return datapoints
    .map((datapoint) => ({
      timestamp: datapoint?.Timestamp,
      value: Number(datapoint?.Sum || 0)
    }))
    .filter((datapoint) => datapoint.timestamp && Number.isFinite(datapoint.value))
}

/**
 * Computes the total observed Sum statistic for one metric across the smoke window.
 *
 * @param {object} params Metric total query parameters.
 * @param {string} params.endpoint LocalStack CloudWatch endpoint.
 * @param {string} params.metricName CloudWatch metric name.
 * @param {string} params.startTime ISO start time for the smoke window.
 * @param {string} params.endTime ISO end time for the smoke window.
 * @param {object} params.parser XML parser instance.
 * @returns {Promise<number>} Total metric sum across all datapoints in the window.
 */
const getMetricTotal = async ({
  endpoint,
  metricName,
  startTime,
  endTime,
  parser
}) => {
  const datapoints = await getMetricDatapoints({
    endpoint,
    metricName,
    startTime,
    endTime,
    parser
  })

  return datapoints.reduce((sum, datapoint) => sum + datapoint.value, 0)
}

/**
 * Captures a baseline or post-run snapshot for the metrics relevant to the consumer smoke.
 *
 * @param {object} params Snapshot parameters.
 * @param {string} params.endpoint LocalStack CloudWatch endpoint.
 * @param {Array<string>} params.metricNames CloudWatch metric names to read.
 * @param {string} params.startTime ISO start time for the smoke window.
 * @param {string} params.endTime ISO end time for the smoke window.
 * @param {object} params.parser XML parser instance.
 * @returns {Promise<object>} Map of metric names to total observed sums.
 */
const captureMetricSnapshot = async ({
  endpoint,
  metricNames,
  startTime,
  endTime,
  parser
}) => {
  const totals = await Promise.all(metricNames.map(async (metricName) => ([
    metricName,
    await getMetricTotal({
      endpoint,
      metricName,
      startTime,
      endTime,
      parser
    })
  ])))

  return Object.fromEntries(totals)
}

/**
 * Computes per-metric deltas between two snapshots.
 *
 * @param {object} params Delta parameters.
 * @param {object} params.before Baseline metric totals.
 * @param {object} params.after Post-run metric totals.
 * @returns {object} Map of metric names to delta values.
 */
const buildMetricDeltas = ({
  before,
  after
}) => Object.fromEntries(
  Object.keys(after).map((metricName) => [
    metricName,
    (after[metricName] || 0) - (before[metricName] || 0)
  ])
)

/**
 * Polls LocalStack until the expected metric deltas appear or times out.
 *
 * @param {object} params Polling parameters.
 * @param {string} params.endpoint LocalStack CloudWatch endpoint.
 * @param {Array<string>} params.metricNames CloudWatch metric names to read.
 * @param {string} params.startTime ISO start time for the smoke window.
 * @param {object} params.expectedDeltas Expected minimum delta by metric name.
 * @param {object} params.parser XML parser instance.
 * @param {number} [params.attempt=1] Current polling attempt.
 * @returns {Promise<{afterSnapshot: object, deltas: object}>} Final snapshot and deltas.
 */
const waitForMetricDeltas = async ({
  endpoint,
  metricNames,
  startTime,
  expectedDeltas,
  parser,
  attempt = 1
}) => {
  const afterSnapshot = await captureMetricSnapshot({
    endpoint,
    metricNames,
    startTime,
    endTime: new Date().toISOString(),
    parser
  })
  const deltas = buildMetricDeltas({
    before: expectedDeltas.beforeSnapshot,
    after: afterSnapshot
  })

  const allSatisfied = Object.entries(expectedDeltas.minimums).every(
    ([metricName, expectedDelta]) => (deltas[metricName] || 0) >= expectedDelta
  )

  if (allSatisfied) {
    return {
      afterSnapshot,
      deltas
    }
  }

  if (attempt >= 20) {
    throw new Error(
      `Timed out waiting for expected consumer metric deltas. Observed deltas=${JSON.stringify(deltas)}`
    )
  }

  await sleep(500)

  return waitForMetricDeltas({
    endpoint,
    metricNames,
    startTime,
    expectedDeltas,
    parser,
    attempt: attempt + 1
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
          MOCK_CMR_PORT: String(mockCmrPort)
        },
        stdio: 'inherit'
      }
    )

    await waitForHealth(`${cmrBaseUrl}/health`)
  }

  await waitForCloudWatch({
    endpoint: cloudWatchEndpoint
  })

  process.env.CMR_BASE_URL = cmrBaseUrl
  process.env.CMR_WRITEBACK_PROVIDERS = process.env.CMR_WRITEBACK_PROVIDERS || providerId
  process.env.CMR_WRITER_TOKEN = process.env.CMR_WRITER_TOKEN || 'local-writer-token'
  process.env.AWS_ENDPOINT_URL = cloudWatchEndpoint

  redisClient = await seedKeywordCaches()
  await clearAuditRowsForCollection()

  const { runMetadataCorrection } = await import('../../serverless/src/runMetadataCorrection/handler')
  const { getCmrCollectionNativeMetadata } = await import('../../serverless/src/shared/getCmrCollectionNativeMetadata')
  const parser = await createParser()

  const metricNames = [
    CONSUMER_METRIC_NAMES.EVENTS_CONSUMED,
    CONSUMER_METRIC_NAMES.EVENTS_PROCESSED,
    CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
    CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
    CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
    CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
    CONSUMER_METRIC_NAMES.CORRECTIONS_WRITTEN_TO_CMR,
    CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_EVENT,
    CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_MANUAL
  ]

  const beforeSnapshot = await captureMetricSnapshot({
    endpoint: cloudWatchEndpoint,
    metricNames,
    startTime: measurementWindowStart,
    endTime: new Date().toISOString(),
    parser
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

  if ((responseBody.correctionResult?.correctionCount || 0) < 1) {
    throw new Error(`Expected at least one applied correction for ${collectionConceptId}`)
  }

  if (responseBody.writeResult?.ingestResult?.updated !== true) {
    throw new Error(`Expected successful mock CMR writeback for ${collectionConceptId}`)
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

  const {
    afterSnapshot,
    deltas
  } = await waitForMetricDeltas({
    endpoint: cloudWatchEndpoint,
    metricNames,
    startTime: measurementWindowStart,
    expectedDeltas: {
      beforeSnapshot,
      minimums: {
        [CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT]: 1,
        [CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED]: 1,
        [CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA]: 1,
        [CONSUMER_METRIC_NAMES.CORRECTIONS_WRITTEN_TO_CMR]: 1,
        [CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_MANUAL]: 1
      }
    },
    parser
  })

  if ((deltas[CONSUMER_METRIC_NAMES.EVENTS_CONSUMED] || 0) !== 0) {
    throw new Error(
      'Expected EventsConsumed delta to remain 0 for the manual sync flow, '
      + `received ${deltas[CONSUMER_METRIC_NAMES.EVENTS_CONSUMED]}`
    )
  }

  if ((deltas[CONSUMER_METRIC_NAMES.EVENTS_PROCESSED] || 0) !== 0) {
    throw new Error(
      'Expected EventsProcessed delta to remain 0 for the manual sync flow, '
      + `received ${deltas[CONSUMER_METRIC_NAMES.EVENTS_PROCESSED]}`
    )
  }

  if ((deltas[CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES] || 0) !== 0) {
    throw new Error(
      'Expected EventProcessingFailures delta to remain 0, '
      + `received ${deltas[CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES]}`
    )
  }

  if ((deltas[CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_EVENT] || 0) !== 0) {
    throw new Error(
      'Expected RecordsUpdatedFromEvent delta to remain 0 for the manual sync flow, '
      + `received ${deltas[CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_EVENT]}`
    )
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify({
    collectionConceptId,
    providerId,
    cmrBaseUrl,
    cloudWatchEndpoint,
    metricNamespace,
    responseBody,
    beforeSnapshot,
    afterSnapshot,
    deltas,
    updatedPlatform
  }, null, 2), 'utf8')

  console.log('[metadata-correction-consumer-metrics-manual-sync-smoke] Completed successfully')
  console.log(JSON.stringify({
    collectionConceptId,
    providerId,
    cmrBaseUrl,
    cloudWatchEndpoint,
    metricNamespace,
    outcome: responseBody.outcome,
    deltas,
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
