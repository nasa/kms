import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import { mockClient } from 'aws-sdk-client-mock'
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

const cloudWatchMock = mockClient(CloudWatchClient)

describe('emitConsumerMetrics', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    cloudWatchMock.reset()

    cloudWatchMock.on(PutMetricDataCommand).resolves({})

    vi.spyOn(logger, 'debug').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn())
    delete process.env.AWS_ENDPOINT_URL
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

    const sentCommand = cloudWatchMock.commandCalls(PutMetricDataCommand)[0].args[0].input
    expect(sentCommand).toEqual({
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

    expect(cloudWatchMock.commandCalls(PutMetricDataCommand).length).toBe(1)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(logger.debug).toHaveBeenCalledWith(
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

    const sentCommand = cloudWatchMock.commandCalls(PutMetricDataCommand)[0].args[0].input
    expect(sentCommand).toEqual({
      Namespace: CONSUMER_METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          Unit: 'Count',
          Value: 0
        }
      ]
    })

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  test('emits metrics to LocalStack CloudWatch with the query api when AWS_ENDPOINT_URL is set', async () => {
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566'

    vi.mocked(fetch).mockResolvedValue({
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

    // Verify CloudWatch was not called
    expect(cloudWatchMock.commandCalls(PutMetricDataCommand).length).toBe(0)

    // Verify fetch was called
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://localhost:4566', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
      body: expect.any(String)
    })

    // Access the body from the fetch mock calls
    const fetchCalls = vi.mocked(fetch).mock.calls
    const requestBody = new URLSearchParams(fetchCalls[0][1].body)

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
    vi.mocked(fetch).mockResolvedValue({
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
    })).rejects.toThrow('Failed to emit consumer keyword sync metrics')
  })

  test('logs and swallows metric emission failures when using the safe helper', async () => {
    cloudWatchMock.on(PutMetricDataCommand).rejectsOnce(new Error('cloudwatch unavailable'))
    vi.spyOn(logger, 'error').mockImplementation(() => {})

    await expect(emitConsumerMetricsSafely({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.EVENT_PROCESSING_FAILURES,
          value: 1
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit processing metrics',
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

  test('logs metric emission failures when safe helper uses the default empty log context', async () => {
    cloudWatchMock.on(PutMetricDataCommand).rejectsOnce(new Error('cloudwatch unavailable'))
    vi.spyOn(logger, 'error').mockImplementation(() => {})

    await expect(emitConsumerMetricsSafely({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.EVENTS_CONSUMED,
          value: 1
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit processing metrics'
    })).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Failed to emit processing metrics',
      {
        metrics: [
          {
            metricName: CONSUMER_METRIC_NAMES.EVENTS_CONSUMED,
            value: 1
          }
        ],
        error: 'cloudwatch unavailable'
      }
    )
  })
})
