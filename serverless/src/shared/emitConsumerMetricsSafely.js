import { emitConsumerMetrics } from '@/shared/emitConsumerMetrics'
import { logger } from '@/shared/logger'

/**
 * Best-effort wrapper around consumer metric emission.
 *
 * The correction worker and the shared collection runner both emit CloudWatch metrics, but
 * metric delivery should never break the actual metadata-correction flow. This helper keeps that
 * behavior in one place: try to emit, log enough context on failure, and then let processing
 * continue.
 *
 * @param {Object} params Safe emission details.
 * @param {Array<{metricName: string, value: number}>} params.metrics Metrics to emit.
 * @param {string} params.logMessage Error log message to use when metric emission fails.
 * @param {Object} [params.logContext={}] Structured log context for failed emission.
 * @returns {Promise<void>}
 */
export const emitConsumerMetricsSafely = async ({
  metrics,
  logMessage,
  logContext = {}
}) => {
  try {
    await emitConsumerMetrics({
      metrics
    })
  } catch (metricError) {
    logger.error(logMessage, {
      ...logContext,
      metrics,
      error: metricError.message
    })
  }
}

export default emitConsumerMetricsSafely
