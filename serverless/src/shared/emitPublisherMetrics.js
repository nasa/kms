import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'

import { logger } from './logger'

/**
 * Shared metric namespace used for keyword sync monitoring.
 * @type {string}
 */
export const PUBLISHER_METRIC_NAMESPACE = 'KMS/KeywordSync'

/**
 * Publisher metric names emitted during keyword analysis and event publishing.
 * @type {{[key: string]: string}}
 */
export const PUBLISHER_METRIC_NAMES = {
  KEYWORD_CHANGES_DETECTED: 'KeywordChangesDetected',
  KEYWORD_EVENTS_GENERATED: 'KeywordEventsGenerated',
  KEYWORD_EVENTS_PUBLISHED: 'KeywordEventsPublished',
  KEYWORD_EVENT_PUBLISH_FAILURES: 'KeywordEventPublishFailures'
}

/**
 * Creates a CloudWatch client for standard AWS metric emission.
 *
 * @returns {CloudWatchClient} Configured CloudWatch client instance.
 */
const createCloudWatchClient = () => new CloudWatchClient({})

const cloudWatchClient = createCloudWatchClient()

/**
 * Converts publisher metric name/value pairs into CloudWatch MetricData entries.
 *
 * @param {Object} params - Metric serialization details.
 * @param {Array<{metricName: string, value: number}>} params.metrics - Metrics to emit.
 * @returns {Array<Object>} CloudWatch MetricData payload.
 */
const buildMetricData = ({ metrics }) => metrics.map(({ metricName, value }) => ({
  MetricName: metricName,
  Unit: 'Count',
  Value: value
}))

/**
 * Builds a CloudWatch Query API request body for metric emission.
 *
 * LocalStack's CloudWatch emulation currently responds more reliably to the
 * classic Query API shape than the SDK's JSON/protocol path, so local metric
 * tests use this form while deployed AWS continues to use the SDK client.
 *
 * @param {Object} params - Query serialization details.
 * @param {Array<{metricName: string, value: number}>} params.metrics - Metrics to emit.
 * @returns {string} URL-encoded request body for PutMetricData.
 */
const buildCloudWatchQueryRequestBody = ({ metrics }) => {
  const params = new URLSearchParams({
    Action: 'PutMetricData',
    Version: '2010-08-01',
    Namespace: PUBLISHER_METRIC_NAMESPACE
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
 * Emits publisher metrics through the CloudWatch Query API.
 *
 * This path is used for local LocalStack verification, where the CloudWatch
 * endpoint is provided through AWS_ENDPOINT_URL.
 *
 * @param {Object} params - Query API emission details.
 * @param {string} params.endpoint - Local CloudWatch-compatible endpoint.
 * @param {Array<{metricName: string, value: number}>} params.metrics - Metrics to emit.
 * @returns {Promise<void>}
 */
const emitPublisherMetricsWithQueryApi = async ({ endpoint, metrics }) => {
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
      'Failed to emit keyword sync metrics to LocalStack. '
        + `Status: ${response.status}. Response: ${responseBody}`
    )
  }
}

/**
 * Emits one or more publisher metrics to CloudWatch.
 *
 * @param {Object} params - Metric emission details.
 * @param {Array<{metricName: string, value: number}>} params.metrics - Metrics to emit.
 * @returns {Promise<void>}
 */
export const emitPublisherMetrics = async ({ metrics }) => {
  const endpoint = process.env.AWS_ENDPOINT_URL
  const metricData = buildMetricData({
    metrics
  })

  if (endpoint) {
    await emitPublisherMetricsWithQueryApi({
      endpoint,
      metrics
    })
  } else {
    await cloudWatchClient.send(new PutMetricDataCommand({
      Namespace: PUBLISHER_METRIC_NAMESPACE,
      MetricData: metricData
    }))
  }

  logger.info(
    '[publisher] Emitted publisher metrics '
      + `namespace=${PUBLISHER_METRIC_NAMESPACE} `
      + `metrics=${metrics.map(({ metricName, value }) => `${metricName}:${value}`).join(',')}`
  )
}

export default emitPublisherMetrics
