#!/usr/bin/env node

const CLOUDWATCH_API_VERSION = '2010-08-01'
const DEFAULT_ENDPOINT = 'http://localhost:4566'
const DEFAULT_NAMESPACE = 'KMS/KeywordSync'
const DEFAULT_LOOKBACK_MINUTES = 60
const DEFAULT_PERIOD_SECONDS = 60
const DEFAULT_STATISTIC = 'Sum'

const createParser = async () => {
  const { XMLParser } = await import('fast-xml-parser')

  return new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true
  })
}

const toArray = (value) => {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

const formatNumber = (value) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(2)
}

const postCloudWatchQuery = async ({ endpoint, params }) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    },
    body: new URLSearchParams(params).toString()
  })

  if (!response.ok) {
    const responseBody = await response.text()

    throw new Error(
      `CloudWatch query failed. Status=${response.status}. Response=${responseBody}`
    )
  }

  return response.text()
}

const listMetricNames = async ({ endpoint, namespace, parser }) => {
  const responseXml = await postCloudWatchQuery({
    endpoint,
    params: {
      Action: 'ListMetrics',
      Version: CLOUDWATCH_API_VERSION,
      Namespace: namespace
    }
  })

  const result = parser.parse(responseXml)
  const metrics = toArray(result?.ListMetricsResponse?.ListMetricsResult?.Metrics?.member)

  return [...new Set(metrics.map((metric) => metric?.MetricName).filter(Boolean))].sort()
}

const getMetricDatapoints = async ({
  endpoint,
  namespace,
  metricName,
  startTime,
  endTime,
  periodSeconds,
  statistic,
  parser
}) => {
  const responseXml = await postCloudWatchQuery({
    endpoint,
    params: {
      Action: 'GetMetricStatistics',
      Version: CLOUDWATCH_API_VERSION,
      Namespace: namespace,
      MetricName: metricName,
      StartTime: startTime,
      EndTime: endTime,
      Period: String(periodSeconds),
      'Statistics.member.1': statistic
    }
  })

  const result = parser.parse(responseXml)
  const datapoints = toArray(
    result?.GetMetricStatisticsResponse?.GetMetricStatisticsResult?.Datapoints?.member
  )

  return datapoints
    .map((datapoint) => ({
      timestamp: datapoint?.Timestamp,
      value: datapoint?.[statistic]
    }))
    .filter((datapoint) => datapoint.timestamp && datapoint.value !== undefined)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
}

const main = async () => {
  const parser = await createParser()
  const endpoint = process.env.LOCALSTACK_ENDPOINT
    || process.env.AWS_ENDPOINT_URL
    || DEFAULT_ENDPOINT
  const namespace = process.env.METRIC_NAMESPACE || DEFAULT_NAMESPACE
  const lookbackMinutes = Number(process.env.LOOKBACK_MINUTES || DEFAULT_LOOKBACK_MINUTES)
  const periodSeconds = Number(process.env.PERIOD_SECONDS || DEFAULT_PERIOD_SECONDS)
  const statistic = process.env.METRIC_STATISTIC || DEFAULT_STATISTIC

  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - (lookbackMinutes * 60 * 1000))

  const startIso = startTime.toISOString()
  const endIso = endTime.toISOString()

  console.log(`Endpoint: ${endpoint}`)
  console.log(`Namespace: ${namespace}`)
  console.log(`Window: ${startIso} -> ${endIso}`)
  console.log(`Statistic: ${statistic}`)
  console.log(`Period: ${periodSeconds}s`)
  console.log('')

  const metricNames = await listMetricNames({
    endpoint,
    namespace,
    parser
  })

  if (metricNames.length === 0) {
    console.log(`No metrics found in namespace ${namespace}`)

    return
  }

  const metricSummaries = await Promise.all(metricNames.map(async (metricName) => ({
    metricName,
    datapoints: await getMetricDatapoints({
      endpoint,
      namespace,
      metricName,
      startTime: startIso,
      endTime: endIso,
      periodSeconds,
      statistic,
      parser
    })
  })))

  metricSummaries.forEach(({ metricName, datapoints }) => {
    console.log(metricName)

    if (datapoints.length === 0) {
      console.log('  latest: no datapoints in selected window')
      console.log('')
    } else {
      const [latestDatapoint] = datapoints

      console.log(
        `  latest: ${formatNumber(latestDatapoint.value)} @ ${latestDatapoint.timestamp}`
      )

      console.log('  datapoints:')

      datapoints
        .slice()
        .reverse()
        .forEach((datapoint) => {
          console.log(`    - ${datapoint.timestamp}: ${formatNumber(datapoint.value)}`)
        })

      console.log('')
    }
  })
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
