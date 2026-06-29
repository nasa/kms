import { emitConsumerMetrics } from '@/shared/emitConsumerMetrics'
import { logger } from '@/shared/logger'

/**
 * Emits consumer metrics without failing the caller when CloudWatch is unavailable.
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
