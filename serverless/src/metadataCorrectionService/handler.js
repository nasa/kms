import { delay } from '@/shared/delay'
import { CONSUMER_METRIC_NAMES } from '@/shared/emitConsumerMetrics'
import { emitConsumerMetricsSafely } from '@/shared/emitConsumerMetricsSafely'
import { logger } from '@/shared/logger'
import { persistMetadataCorrectionAuditLog } from '@/shared/persistMetadataCorrectionAuditLog'
import {
  persistMetadataCorrectionWorkflowFailureAuditLog
} from '@/shared/persistMetadataCorrectionWorkflowFailureAuditLog'
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

const MAX_METADATA_CORRECTION_REQUEST_DELAY_MS = 20_000
const MILLISECONDS_PER_MINUTE = 60_000

/**
 * Converts the configured correction-run rate into a per-message pacing delay.
 *
 * @example
 * // With METADATA_CORRECTION_RUNS_PER_MINUTE=10
 * getCorrectionRunPacingDelayMs() // 6000
 *
 * @returns {number} Delay before each queued correction run, or zero when pacing is disabled.
 */
const getCorrectionRunPacingDelayMs = () => {
  const runsPerMinute = Number(process.env.METADATA_CORRECTION_RUNS_PER_MINUTE)

  if (!Number.isInteger(runsPerMinute) || runsPerMinute <= 0) return 0

  return Math.ceil(MILLISECONDS_PER_MINUTE / runsPerMinute)
}

/**
 * Holds the single configured consumer slot long enough to cap correction-run throughput.
 *
 * @param {Object} params Pacing log context.
 * @param {string|undefined} params.collectionConceptId Collection being processed.
 * @param {string|undefined} params.messageId SQS message identifier.
 * @returns {Promise<void>}
 */
const paceQueuedCorrectionRunIfNeeded = async ({
  collectionConceptId,
  messageId
}) => {
  const pacingDelayMs = getCorrectionRunPacingDelayMs()

  if (pacingDelayMs <= 0) return

  logger.info('[metadata-correction] Pacing queued metadata correction request', {
    collectionConceptId,
    messageId,
    pacingDelayMs,
    runsPerMinute: Number(process.env.METADATA_CORRECTION_RUNS_PER_MINUTE)
  })

  await delay(pacingDelayMs)
}

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
 * @returns {Promise<{batchItemFailures: Array}>} Empty failures because each request is attempted
 * once and failures are recorded in the metadata-correction audit log.
 */
export const metadataCorrectionService = async (event) => {
  const records = event?.Records || []

  const processingResults = await Promise.all(records.map(async (record) => {
    let metadataCorrectionRequest = {}
    const messageId = record?.messageId

    try {
      metadataCorrectionRequest = JSON.parse(record?.body || '{}')

      logger.info('[metadata-correction] Received metadata correction request', {
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId,
        metadataCorrectionRequest
      })

      await paceQueuedCorrectionRunIfNeeded({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId
      })

      await delayQueuedManualRequestIfNeeded({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId,
        metadataCorrectionRequest
      })

      await runCollectionMetadataCorrection({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        keywordEvent: metadataCorrectionRequest.keywordEvent,
        messageId,
        publishedVersionName: metadataCorrectionRequest.publishedVersionName,
        source: metadataCorrectionRequest.source
      })

      return { failed: false }
    } catch (error) {
      logger.error('[metadata-correction] Failed to process metadata correction request', error)

      // Previously, rethrowing added this request to batchItemFailures so SQS would retry it,
      // repeating the correction flow even for permanent failures such as CMR 400 responses.
      // Audit the failure and acknowledge the message by returning no batch failures; remaining
      // requests can continue, and failed work requires manual follow-up instead of a retry.
      // Preserve any detailed failure already written by the correction flow, otherwise add
      // a fallback audit record here.
      try {
        if (metadataCorrectionRequest.collectionConceptId) {
          await persistMetadataCorrectionAuditLog({
            runId: messageId,
            status: 'failed',
            preserveFailedDetails: true,
            collectionConceptId: metadataCorrectionRequest.collectionConceptId,
            publishedVersionName: metadataCorrectionRequest.publishedVersionName,
            source: metadataCorrectionRequest.source || 'metadataCorrectionService',
            messageId,
            keywordEvent: metadataCorrectionRequest.keywordEvent,
            outcome: 'request-processing-failed',
            error
          })
        } else {
          await persistMetadataCorrectionWorkflowFailureAuditLog({
            source: 'metadataCorrectionService',
            outcome: 'invalid-correction-request',
            error,
            messageId
          })
        }
      } catch (auditError) {
        logger.error('[metadata-correction] Failed to persist request processing failure', {
          collectionConceptId: metadataCorrectionRequest.collectionConceptId,
          messageId,
          error: auditError?.message || String(auditError)
        })
      }

      return { failed: true }
    }
  }))

  if (records.length > 0) {
    const failureCount = processingResults.filter(({ failed }) => failed).length
    const processedCount = processingResults.length - failureCount

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
  }

  return {
    batchItemFailures: []
  }
}

export default metadataCorrectionService
