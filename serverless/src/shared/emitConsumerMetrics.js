import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'

import { logger } from './logger'

/**
 * Shared metric namespace used for CMR-side keyword sync monitoring.
 * @type {string}
 */
export const CONSUMER_METRIC_NAMESPACE = 'CMR/KeywordSync'

/**
 * Consumer and reconciliation metric names emitted during metadata correction processing.
 * @type {{[key: string]: string}}
 */
export const CONSUMER_METRIC_NAMES = {
  // Count of metadata-correction SQS records the async consumer starts processing.
  EVENTS_CONSUMED: 'EventsConsumed',

  // Count of metadata-correction SQS records that complete without throwing.
  EVENTS_PROCESSED: 'EventsProcessed',

  // Count of metadata-correction SQS records that fail during processing.
  EVENT_PROCESSING_FAILURES: 'EventProcessingFailures',

  // Count of collections successfully updated in CMR by the async keyword-event flow.
  RECORDS_UPDATED_FROM_EVENT: 'RecordsUpdatedFromEvent',

  // Count of collections successfully updated in CMR by the manual single-collection sync endpoint.
  RECORDS_UPDATED_FROM_MANUAL: 'RecordsUpdatedFromManual',

  // Resolver-stage count: how many invalid keyword values were found for the collection.
  INVALID_KEYWORD_COUNT: 'InvalidKeywordCount',

  // How many invalid keyword findings were turned into concrete
  // replace/delete correction plans.
  KEYWORDS_RESOLVED: 'KeywordsResolved',

  // Count of concrete corrections applied to the native metadata payload by the format-specific editor.
  CORRECTIONS_APPLIED_TO_METADATA: 'CorrectionsAppliedToMetadata',

  // Count of applied corrections successfully written to CMR.
  CORRECTIONS_WRITTEN_TO_CMR: 'CorrectionsWrittenToCMR'
}

/**
 * Creates a CloudWatch client for standard AWS metric emission.
 *
 * @returns {CloudWatchClient} Configured CloudWatch client instance.
 */
const createCloudWatchClient = () => new CloudWatchClient({})

const cloudWatchClient = createCloudWatchClient()

/**
 * Converts consumer metric name/value pairs into CloudWatch MetricData entries.
 *
 * @param {Object} params Metric serialization details.
 * @param {Array<{metricName: string, value: number}>} params.metrics Metrics to emit.
 * @returns {Array<Object>} CloudWatch MetricData payload.
 */
const buildMetricData = ({ metrics }) => metrics.map(({ metricName, value }) => ({
  MetricName: metricName,
  Unit: 'Count',
  Value: value
}))

/**
 * Builds a CloudWatch Query API request body for local metric emission.
 *
 * @param {Object} params Query serialization details.
 * @param {Array<{metricName: string, value: number}>} params.metrics Metrics to emit.
 * @returns {string} URL-encoded request body for PutMetricData.
 */
const buildCloudWatchQueryRequestBody = ({ metrics }) => {
  const params = new URLSearchParams({
    Action: 'PutMetricData',
    Version: '2010-08-01',
    Namespace: CONSUMER_METRIC_NAMESPACE
  })

  metrics.forEach(({ metricName, value }, index) => {
    const metricIndex = index + 1

    params.set(`MetricData.member.${metricIndex}.MetricName`, metricName)
    params.set(`MetricData.member.${metricIndex}.Unit`, 'Count')
    params.set(`MetricData.member.${metricIndex}.Value`, String(value))
  })

  return params.toString()
}

/**
 * Emits consumer metrics through the CloudWatch Query API.
 *
 * @param {Object} params Query API emission details.
 * @param {string} params.endpoint Local CloudWatch-compatible endpoint.
 * @param {Array<{metricName: string, value: number}>} params.metrics Metrics to emit.
 * @returns {Promise<void>}
 */
const emitConsumerMetricsWithQueryApi = async ({ endpoint, metrics }) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    },
    body: buildCloudWatchQueryRequestBody({
      metrics
    })
  })

  if (!response.ok) {
    const responseBody = await response.text()

    throw new Error(
      'Failed to emit consumer keyword sync metrics. '
      + `Status: ${response.status}. Response: ${responseBody}`
    )
  }
}

/**
 * Emits one or more consumer metrics to CloudWatch.
 *
 * @param {Object} params Metric emission details.
 * @param {Array<{metricName: string, value: number}>} params.metrics Metrics to emit.
 * @returns {Promise<void>}
 */
export const emitConsumerMetrics = async ({ metrics }) => {
  const endpoint = process.env.AWS_ENDPOINT_URL
  const metricData = buildMetricData({
    metrics
  })

  if (endpoint) {
    await emitConsumerMetricsWithQueryApi({
      endpoint,
      metrics
    })
  } else {
    await cloudWatchClient.send(new PutMetricDataCommand({
      Namespace: CONSUMER_METRIC_NAMESPACE,
      MetricData: metricData
    }))
  }

  logger.debug(
    '[consumer-metrics] Emitted consumer metrics '
    + `namespace=${CONSUMER_METRIC_NAMESPACE} `
    + `metrics=${metrics.map(({ metricName, value }) => `${metricName}:${value}`).join(',')}`
  )
}

export default emitConsumerMetrics
