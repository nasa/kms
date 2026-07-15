import { delay } from '@/shared/delay'
import { CONSUMER_METRIC_NAMES } from '@/shared/emitConsumerMetrics'
import { emitConsumerMetricsSafely } from '@/shared/emitConsumerMetricsSafely'
import { logger } from '@/shared/logger'
import { runCollectionMetadataCorrection } from '@/shared/runCollectionMetadataCorrection'

/**
 * Builds the batch-level processing metrics emitted by the async correction consumer.
 *
 * @param {Object} params Batch processing counts.
 * @param {number} params.consumedCount Number of SQS records received in the batch.
 * @param {number} params.processedCount Number of records that completed successfully.
 * @param {number} params.failureCount Number of records that failed during processing.
 * @returns {Array<{metricName: string, value: number}>} Metrics to emit for the batch.
 */
const buildBatchProcessingMetrics = ({
  consumedCount,
  processedCount,
  failureCount
}) => {
  const metrics = [{
    metricName: CONSUMER_METRIC_NAMES.EVENTS_CONSUMED,
    value: consumedCount
  }]

  if (processedCount > 0) {
    metrics.push({
      metricName: CONSUMER_METRIC_NAMES.EVENTS_PROCESSED,
      value: processedCount
    })
  }

  if (failureCount > 0) {
    metrics.push({
      metricName: CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
      value: failureCount
    })
  }

  return metrics
}

const MAX_METADATA_CORRECTION_REQUEST_DELAY_MS = 2000

/**
 * Reads the optional async correction request delay from environment configuration.
 *
 * @returns {number} Delay in milliseconds, or `0` when unset/invalid.
 */
const getMetadataCorrectionRequestDelayMs = () => {
  const rawValue = process.env.METADATA_CORRECTION_REQUEST_DELAY_MS

  if (!rawValue) {
    return 0
  }

  const parsedValue = Number(rawValue)

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.min(parsedValue, MAX_METADATA_CORRECTION_REQUEST_DELAY_MS)
    : 0
}

/**
 * Applies the optional delay window for queued manual API requests before processing starts.
 *
 * @param {Object} params Delay inputs.
 * @param {string|undefined} params.collectionConceptId Collection concept id being processed.
 * @param {string|undefined} params.messageId SQS message id for logging.
 * @param {Object} params.metadataCorrectionRequest Parsed metadata correction request.
 * @returns {Promise<void>}
 */
const delayQueuedManualRequestIfNeeded = async ({
  collectionConceptId,
  messageId,
  metadataCorrectionRequest
}) => {
  const configuredDelayMs = getMetadataCorrectionRequestDelayMs()

  if (configuredDelayMs <= 0
    || metadataCorrectionRequest?.source !== 'metadataCorrectionApi'
    || typeof metadataCorrectionRequest?.requestedAt !== 'string') {
    return
  }

  const requestedAtMs = Date.parse(metadataCorrectionRequest.requestedAt)

  if (Number.isNaN(requestedAtMs)) {
    return
  }

  const remainingDelayMs = (requestedAtMs + configuredDelayMs) - Date.now()

  if (remainingDelayMs <= 0) {
    return
  }

  logger.info('[metadata-correction] Delaying queued manual metadata correction request', {
    collectionConceptId,
    messageId,
    requestedAt: metadataCorrectionRequest.requestedAt,
    configuredDelayMs,
    remainingDelayMs
  })

  await delay(remainingDelayMs)
}

/**
 * Metadata correction service that consumes collection-scoped correction requests from SQS.
 *
 * The worker remains asynchronous for keyword-event-driven correction requests, but the actual
 * "fix one collection" business logic now lives in `runCollectionMetadataCorrection` so the same
 * flow can also be reused by synchronous API endpoints.
 *
 * @param {{ Records?: Array<{ body?: string, messageId?: string }> }} event - SQS batch event.
 * @returns {Promise<{batchItemFailures: Array}>} Empty batch failures for acknowledged messages.
 */
export const metadataCorrectionService = async (event) => {
  const records = event?.Records || []

  const settledResults = await Promise.allSettled(records.map(async (record) => {
    try {
      const metadataCorrectionRequest = JSON.parse(record.body || '{}')

      logger.info('[metadata-correction] Received metadata correction request', {
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId: record.messageId,
        metadataCorrectionRequest
      })

      await delayQueuedManualRequestIfNeeded({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId: record.messageId,
        metadataCorrectionRequest
      })

      await runCollectionMetadataCorrection({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        keywordEvent: metadataCorrectionRequest.keywordEvent,
        messageId: record.messageId,
        source: metadataCorrectionRequest.source
      })
    } catch (error) {
      logger.error('[metadata-correction] Failed to process metadata correction request', error)
      throw error
    }
  }))

  if (records.length > 0) {
    const processedCount = settledResults.filter(({ status }) => status === 'fulfilled').length
    const failureCount = settledResults.length - processedCount

    await emitConsumerMetricsSafely({
      metrics: buildBatchProcessingMetrics({
        consumedCount: records.length,
        processedCount,
        failureCount
      }),
      errorLogMessage: '[metadata-correction] Failed to emit async batch processing metrics',
      logContext: {
        failureCount,
        messageIds: records.map(({ messageId }) => messageId).filter(Boolean),
        processedCount,
        recordCount: records.length
      }
    })

    const firstRejectedResult = settledResults.find(({ status }) => status === 'rejected')

    if (firstRejectedResult) {
      throw firstRejectedResult.reason
    }
  }

  return {
    batchItemFailures: []
  }
}

export default metadataCorrectionService
