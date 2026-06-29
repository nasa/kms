import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'

import {
  CONSUMER_METRIC_NAMES,
  CONSUMER_METRIC_NAMESPACE,
  emitConsumerMetrics
} from '../emitConsumerMetrics'
import { emitConsumerMetricsSafely } from '../emitConsumerMetricsSafely'

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

describe('emitConsumerMetrics', () => {
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

  test('publishes the provided consumer metrics to CloudWatch', async () => {
    await emitConsumerMetrics({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.EVENTS_CONSUMED,
          value: 3
        },
        {
          metricName: CONSUMER_METRIC_NAMES.EVENTS_PROCESSED,
          value: 2
        },
        {
          metricName: CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
          value: 1
        }
      ]
    })

    expect(PutMetricDataCommandMock).toHaveBeenCalledWith({
      Namespace: CONSUMER_METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: CONSUMER_METRIC_NAMES.EVENTS_CONSUMED,
          Unit: 'Count',
          Value: 3
        },
        {
          MetricName: CONSUMER_METRIC_NAMES.EVENTS_PROCESSED,
          Unit: 'Count',
          Value: 2
        },
        {
          MetricName: CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
          Unit: 'Count',
          Value: 1
        }
      ]
    })

    expect(sendCloudWatchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('EventsConsumed:3')
    )
  })

  test('publishes zero-valued metrics without dimensions', async () => {
    await emitConsumerMetrics({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 0
        }
      ]
    })

    expect(PutMetricDataCommandMock).toHaveBeenCalledWith({
      Namespace: CONSUMER_METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          Unit: 'Count',
          Value: 0
        }
      ]
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('emits metrics to LocalStack CloudWatch with the query api when AWS_ENDPOINT_URL is set', async () => {
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566'
    fetchMock.mockResolvedValue({
      ok: true
    })

    await emitConsumerMetrics({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
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
    expect(requestBody.get('Namespace')).toBe(CONSUMER_METRIC_NAMESPACE)
    expect(requestBody.get('MetricData.member.1.MetricName')).toBe(
      CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED
    )

    expect(requestBody.get('MetricData.member.1.Value')).toBe('1')
  })

  test('throws when the LocalStack CloudWatch query request fails', async () => {
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566'
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('<?xml version="1.0"?><ErrorResponse />')
    })

    await expect(emitConsumerMetrics({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
          value: 1
        }
      ]
    })).rejects.toThrow('Failed to emit consumer keyword sync metrics to LocalStack')
  })

  test('logs and swallows metric emission failures when using the safe helper', async () => {
    sendCloudWatchMock.mockRejectedValueOnce(new Error('cloudwatch unavailable'))
    vi.spyOn(logger, 'error').mockImplementation(() => {})

    await expect(emitConsumerMetricsSafely({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
          value: 1
        }
      ],
      logMessage: '[metadata-correction] Failed to emit processing metrics',
      logContext: {
        messageId: 'message-1'
      }
    })).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Failed to emit processing metrics',
      expect.objectContaining({
        messageId: 'message-1',
        error: 'cloudwatch unavailable',
        metrics: [
          {
            metricName: CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
            value: 1
          }
        ]
      })
    )
  })
})
