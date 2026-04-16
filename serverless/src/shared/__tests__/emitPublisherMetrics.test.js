import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'

import {
  emitPublisherMetrics,
  PUBLISHER_METRIC_NAMES,
  PUBLISHER_METRIC_NAMESPACE
} from '../emitPublisherMetrics'

const {
  CloudWatchClientMock,
  fetchMock,
  sendCloudWatchMock,
  PutMetricDataCommandMock
} = vi.hoisted(() => ({
  CloudWatchClientMock: vi.fn(() => ({
    send: sendCloudWatchMock
  })),
  fetchMock: vi.fn(),
  sendCloudWatchMock: vi.fn(),
  PutMetricDataCommandMock: vi.fn((input) => input)
}))

vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: CloudWatchClientMock,
  PutMetricDataCommand: PutMetricDataCommandMock
}))

describe('emitPublisherMetrics', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    CloudWatchClientMock.mockImplementation(() => ({
      send: sendCloudWatchMock
    }))

    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', fetchMock)
    delete process.env.AWS_ENDPOINT_URL
    sendCloudWatchMock.mockResolvedValue({})
  })

  test('should publish the provided publisher metrics with the current stage dimension', async () => {
    await emitPublisherMetrics({
      metrics: [
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_CHANGES_DETECTED,
          value: 3
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_PUBLISHED,
          value: 2
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENT_PUBLISH_FAILURES,
          value: 1
        }
      ]
    })

    expect(PutMetricDataCommandMock).toHaveBeenCalledWith({
      Namespace: PUBLISHER_METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: PUBLISHER_METRIC_NAMES.KEYWORD_CHANGES_DETECTED,
          Unit: 'Count',
          Value: 3
        },
        {
          MetricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_PUBLISHED,
          Unit: 'Count',
          Value: 2
        },
        {
          MetricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENT_PUBLISH_FAILURES,
          Unit: 'Count',
          Value: 1
        }
      ]
    })

    expect(sendCloudWatchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('KeywordChangesDetected:3')
    )
  })

  test('should publish metrics without dimensions', async () => {
    await emitPublisherMetrics({
      metrics: [
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_GENERATED,
          value: 0
        }
      ]
    })

    expect(PutMetricDataCommandMock).toHaveBeenCalledWith({
      Namespace: PUBLISHER_METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_GENERATED,
          Unit: 'Count',
          Value: 0
        }
      ]
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('should emit metrics to LocalStack CloudWatch with the query api when AWS_ENDPOINT_URL is set', async () => {
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566'
    fetchMock.mockResolvedValue({
      ok: true
    })

    await emitPublisherMetrics({
      metrics: [
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_GENERATED,
          value: 1
        }
      ]
    })

    expect(sendCloudWatchMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4566', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
      body: expect.any(String)
    })

    const requestBody = new URLSearchParams(fetchMock.mock.calls[0][1].body)

    expect(requestBody.get('Action')).toBe('PutMetricData')
    expect(requestBody.get('Version')).toBe('2010-08-01')
    expect(requestBody.get('Namespace')).toBe(PUBLISHER_METRIC_NAMESPACE)
    expect(requestBody.get('MetricData.member.1.MetricName')).toBe(
      PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_GENERATED
    )

    expect(requestBody.get('MetricData.member.1.Value')).toBe('1')
    expect(requestBody.get('MetricData.member.1.Dimensions.member.1.Name')).toBeNull()
    expect(requestBody.get('MetricData.member.1.Dimensions.member.1.Value')).toBeNull()
  })

  test('should throw when the LocalStack CloudWatch query request fails', async () => {
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566'
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('<?xml version="1.0"?><ErrorResponse />')
    })

    await expect(emitPublisherMetrics({
      metrics: [
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENT_PUBLISH_FAILURES,
          value: 1
        }
      ]
    })).rejects.toThrow('Failed to emit keyword sync metrics to LocalStack')
  })
})
