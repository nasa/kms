import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { emitPublisherMetrics, PUBLISHER_METRIC_NAMES } from '@/shared/emitPublisherMetrics'
import { exportRdfToS3 } from '@/shared/exportRdfToS3'
import { logger } from '@/shared/logger'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { publishKeywordEvent } from '@/shared/publishKeywordEvent'
import { getPublishKeywordEvents } from '@/shared/redis-path-store/getPublishKeywordEvents'
import {
  rebuildHistoricalConceptCache
} from '@/shared/redis-path-store/rebuildHistoricalConceptCache'
import { writePublishedConceptCaches } from '@/shared/redis-path-store/writePublishedConceptCaches'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { publisher } from '../handler'

const SCIENCE_PATH_KEYWORD = {
  Category: 'PATH',
  Topic: '',
  Term: '',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const SCIENCE_PATH_ONE_KEYWORD = {
  Category: 'PATH 1',
  Topic: '',
  Term: '',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const SCIENCE_PATH_TWO_KEYWORD = {
  Category: 'PATH 2',
  Topic: '',
  Term: '',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const { sendEventBridgeMock, PutEventsCommandMock } = vi.hoisted(() => ({
  sendEventBridgeMock: vi.fn(),
  PutEventsCommandMock: vi.fn((input) => input)
}))

const createInsertedScienceKeywordEvent = ({
  uuid,
  keywordObject
}) => ({
  EventType: 'INSERTED',
  Scheme: 'sciencekeywords',
  UUID: uuid,
  NewKeywordObject: keywordObject,
  Timestamp: '2023-06-01T00:00:00.000Z',
  MetadataSpecification: {
    URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
    Name: 'Kms-Keyword-Event',
    Version: '1.0'
  }
})

const buildPublishKeywordEventsResult = ({
  keywordEvents = [],
  keywordChangesMap = new Map(),
  failedSchemes = [],
  totalSchemeCount = 0
} = {}) => {
  const keywordChangeSummary = keywordEvents.reduce((summary, keywordEvent) => {
    if (keywordEvent.EventType === 'INSERTED') {
      return {
        ...summary,
        addedCount: summary.addedCount + 1
      }
    }

    if (keywordEvent.EventType === 'DELETED') {
      return {
        ...summary,
        removedCount: summary.removedCount + 1
      }
    }

    return {
      ...summary,
      changedCount: summary.changedCount + 1
    }
  }, {
    addedCount: 0,
    removedCount: 0,
    changedCount: 0
  })

  return {
    keywordChangesMap,
    keywordEvents,
    keywordChangeSummary,
    failedSchemes,
    totalSchemeCount,
    keywordChangeCount: (
      keywordChangeSummary.addedCount
      + keywordChangeSummary.removedCount
      + keywordChangeSummary.changedCount
    )
  }
}

const mockPublishKeywordEvents = (keywordEvents = []) => {
  vi.mocked(getPublishKeywordEvents).mockResolvedValue(
    buildPublishKeywordEventsResult({
      keywordEvents
    })
  )
}

vi.mock('@/shared/emitPublisherMetrics')
vi.mock('@/shared/exportRdfToS3')
vi.mock('@/shared/operations/updates/getPublishUpdateQuery')
vi.mock('@/shared/publishKeywordEvent')

vi.mock('@/shared/redis-path-store/getPublishKeywordEvents', () => ({
  getPublishKeywordEvents: vi.fn()
}))

vi.mock('@/shared/redis-path-store/rebuildHistoricalConceptCache', () => ({
  rebuildHistoricalConceptCache: vi.fn()
}))

vi.mock('@/shared/redis-path-store/writePublishedConceptCaches', () => ({
  writePublishedConceptCaches: vi.fn()
}))

vi.mock('@/shared/sparqlRequest')
vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(() => ({
    send: sendEventBridgeMock
  })),
  PutEventsCommand: PutEventsCommandMock
}))

describe('publisher handler', () => {
  const mockEvent = {
    detail: {
      versionName: 'v1.0.0',
      publishDate: '2023-06-01T12:00:00.000Z'
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()

    delete process.env.BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE

    vi.mocked(getPublishKeywordEvents).mockResolvedValue(
      buildPublishKeywordEventsResult()
    )

    vi.mocked(rebuildHistoricalConceptCache).mockResolvedValue({
      cacheReady: true
    })

    vi.mocked(writePublishedConceptCaches).mockResolvedValue({
      cacheReady: true
    })

    emitPublisherMetrics.mockResolvedValue()
    exportRdfToS3.mockResolvedValue({ s3Key: 'test/rdf.xml' })
    getPublishUpdateQuery.mockReturnValue('mock query')
    publishKeywordEvent.mockResolvedValue({
      messageId: 'message-1',
      message: '{}',
      topicArn: 'arn:aws:sns:us-east-1:123456789012:keyword-events'
    })

    sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 0 })
    sparqlRequest.mockResolvedValue({ ok: true })

    vi.spyOn(logger, 'debug').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
  })

  test('successfully processes publish events with generated keyword events', async () => {
    mockPublishKeywordEvents([
      createInsertedScienceKeywordEvent({
        uuid: 'uuid1',
        keywordObject: SCIENCE_PATH_KEYWORD
      })
    ])

    const result = await publisher(mockEvent)

    expect(getPublishUpdateQuery).toHaveBeenCalledWith('v1.0.0', expect.any(String))
    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      body: 'mock query'
    })

    expect(writePublishedConceptCaches).toHaveBeenCalledTimes(1)
    expect(rebuildHistoricalConceptCache).toHaveBeenCalledTimes(1)
    expect(exportRdfToS3).toHaveBeenCalledWith({ version: 'published' })
    expect(exportRdfToS3).toHaveBeenCalledWith({ version: 'draft' })
    expect(publishKeywordEvent).toHaveBeenCalledTimes(1)
    expect(publishKeywordEvent).toHaveBeenCalledWith(expect.objectContaining({
      EventType: 'INSERTED',
      Scheme: 'sciencekeywords',
      UUID: 'uuid1',
      NewKeywordObject: SCIENCE_PATH_KEYWORD
    }))

    expect(sendEventBridgeMock).toHaveBeenCalledTimes(1)

    expect(result).toEqual({
      status: 'success',
      versionName: 'v1.0.0',
      publishDate: mockEvent.detail.publishDate,
      published: true,
      keywordChangesDetected: 1,
      keywordEventsGenerated: 1,
      keywordEventsPublished: 1,
      keywordEventPublishFailures: 0,
      cachePrimeEventEmitted: true,
      keywordEventsCount: 1,
      postPublishFailures: []
    })

    expect(emitPublisherMetrics).toHaveBeenCalledWith({
      metrics: [
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_CHANGES_DETECTED,
          value: 1
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_GENERATED,
          value: 1
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_PUBLISHED,
          value: 1
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENT_PUBLISH_FAILURES,
          value: 0
        }
      ]
    })
  })

  test('fails before publish when keyword event generation fails', async () => {
    vi.mocked(getPublishKeywordEvents).mockRejectedValue(
      new Error('Scheme lookup failed')
    )

    await expect(publisher(mockEvent)).rejects.toThrow('Scheme lookup failed')

    expect(sparqlRequest).not.toHaveBeenCalled()
    expect(publishKeywordEvent).not.toHaveBeenCalled()
    expect(sendEventBridgeMock).not.toHaveBeenCalled()
  })

  test('returns partial_success when published CSV export fails', async () => {
    mockPublishKeywordEvents([
      createInsertedScienceKeywordEvent({
        uuid: 'uuid1',
        keywordObject: SCIENCE_PATH_KEYWORD
      })
    ])

    vi.mocked(writePublishedConceptCaches).mockRejectedValue(new Error('S3 CSV export failed'))

    const result = await publisher(mockEvent)

    expect(rebuildHistoricalConceptCache).not.toHaveBeenCalled()
    expect(publishKeywordEvent).not.toHaveBeenCalled()
    expect(result.status).toBe('partial_success')
    expect(result.postPublishFailures).toContain('Failed to export Published Scheme CSVs to S3: S3 CSV export failed')
    expect(result.postPublishFailures).toContain('Skipped Historical Concept cache build because CSV export failed')
    expect(result.postPublishFailures).toContain('Skipped keyword event publish because keyword caches were not fully prepared')
  })

  test('returns partial_success when historical cache rebuild fails', async () => {
    mockPublishKeywordEvents([
      createInsertedScienceKeywordEvent({
        uuid: 'uuid1',
        keywordObject: SCIENCE_PATH_KEYWORD
      })
    ])

    vi.mocked(rebuildHistoricalConceptCache).mockRejectedValue(
      new Error('Cache build failed')
    )

    const result = await publisher(mockEvent)

    expect(publishKeywordEvent).not.toHaveBeenCalled()
    expect(result.status).toBe('partial_success')
    expect(result.postPublishFailures).toContain('Failed to build Historical Concept cache from S3: Cache build failed')
    expect(result.postPublishFailures).toContain('Skipped keyword event publish because keyword caches were not fully prepared')
  })

  test('completes successfully without SNS publish when no keyword events are generated', async () => {
    const result = await publisher(mockEvent)

    expect(publishKeywordEvent).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      '[publisher] No keyword events generated, skipping SNS publish'
    )

    expect(result).toEqual({
      status: 'success',
      versionName: 'v1.0.0',
      publishDate: mockEvent.detail.publishDate,
      published: true,
      keywordChangesDetected: 0,
      keywordEventsGenerated: 0,
      keywordEventsPublished: 0,
      keywordEventPublishFailures: 0,
      cachePrimeEventEmitted: true,
      keywordEventsCount: 0,
      postPublishFailures: []
    })
  })

  test('throws when the SPARQL publish update fails', async () => {
    mockPublishKeywordEvents([
      createInsertedScienceKeywordEvent({
        uuid: 'uuid1',
        keywordObject: SCIENCE_PATH_KEYWORD
      })
    ])

    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await expect(publisher(mockEvent)).rejects.toThrow(
      'Failed to execute publish update: 500 Internal Server Error'
    )

    expect(publishKeywordEvent).not.toHaveBeenCalled()
    expect(sendEventBridgeMock).not.toHaveBeenCalled()
  })

  test('returns partial_success when EventBridge emit fails after SNS publish succeeds', async () => {
    mockPublishKeywordEvents([
      createInsertedScienceKeywordEvent({
        uuid: 'uuid1',
        keywordObject: SCIENCE_PATH_KEYWORD
      })
    ])

    sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 1 })

    const result = await publisher(mockEvent)

    expect(publishKeywordEvent).toHaveBeenCalledTimes(1)
    expect(sendEventBridgeMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      status: 'partial_success',
      versionName: 'v1.0.0',
      publishDate: mockEvent.detail.publishDate,
      published: true,
      keywordChangesDetected: 1,
      keywordEventsGenerated: 1,
      keywordEventsPublished: 1,
      keywordEventPublishFailures: 0,
      cachePrimeEventEmitted: false,
      keywordEventsCount: 1,
      postPublishFailures: ['Publish completed, but failed to emit cache-prime event']
    })
  })

  test('publishes remaining keyword events after retries are exhausted for one event', async () => {
    mockPublishKeywordEvents([
      createInsertedScienceKeywordEvent({
        uuid: 'uuid1',
        keywordObject: SCIENCE_PATH_ONE_KEYWORD
      }),
      createInsertedScienceKeywordEvent({
        uuid: 'uuid2',
        keywordObject: SCIENCE_PATH_TWO_KEYWORD
      })
    ])

    publishKeywordEvent
      .mockRejectedValueOnce(new Error('SNS unavailable'))
      .mockRejectedValueOnce(new Error('SNS unavailable'))
      .mockRejectedValueOnce(new Error('SNS unavailable'))
      .mockRejectedValueOnce(new Error('SNS unavailable'))
      .mockResolvedValueOnce({
        messageId: 'message-2',
        message: '{}',
        topicArn: 'arn:aws:sns:us-east-1:123456789012:keyword-events'
      })

    const result = await publisher(mockEvent)

    expect(publishKeywordEvent).toHaveBeenCalledTimes(5)
    expect(publishKeywordEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ UUID: 'uuid1' }))
    expect(publishKeywordEvent).toHaveBeenNthCalledWith(5, expect.objectContaining({ UUID: 'uuid2' }))
    expect(result).toEqual({
      status: 'partial_success',
      versionName: 'v1.0.0',
      publishDate: mockEvent.detail.publishDate,
      published: true,
      keywordChangesDetected: 2,
      keywordEventsGenerated: 2,
      keywordEventsPublished: 1,
      keywordEventPublishFailures: 1,
      cachePrimeEventEmitted: true,
      keywordEventsCount: 2,
      postPublishFailures: ['Publish completed, but 1 keyword event publishes failed after retries']
    })
  })

  test('throws when versionName is missing', async () => {
    await expect(publisher({ detail: {} })).rejects.toThrow(
      'versionName is required in event.detail'
    )
  })

  test('throws when event.detail is missing entirely', async () => {
    await expect(publisher({})).rejects.toThrow(
      'versionName is required in event.detail'
    )
  })

  test('throws when publishDate is missing', async () => {
    await expect(publisher({
      detail: {
        versionName: 'v1.0.0'
      }
    })).rejects.toThrow('publishDate is required in event.detail')
  })

  test('returns partial_success when published RDF export fails', async () => {
    exportRdfToS3
      .mockRejectedValueOnce(new Error('published rdf failed'))
      .mockResolvedValueOnce({ s3Key: 'draft/rdf.xml' })

    const result = await publisher(mockEvent)

    expect(result.status).toBe('partial_success')
    expect(result.postPublishFailures).toContain(
      'Failed to export Published RDF to S3: published rdf failed'
    )
  })

  test('returns partial_success when draft RDF export fails', async () => {
    exportRdfToS3
      .mockResolvedValueOnce({ s3Key: 'published/rdf.xml' })
      .mockRejectedValueOnce(new Error('draft rdf failed'))

    const result = await publisher(mockEvent)

    expect(result.status).toBe('partial_success')
    expect(result.postPublishFailures).toContain(
      'Failed to export Draft RDF to S3: draft rdf failed'
    )
  })

  test('logs and continues when publisher metrics emission fails', async () => {
    emitPublisherMetrics.mockRejectedValue(new Error('metrics offline'))

    const result = await publisher(mockEvent)

    expect(result.status).toBe('success')
    expect(logger.error).toHaveBeenCalledWith(
      '[publisher] Failed to emit keyword sync metrics for keyword sync summary. Error: metrics offline'
    )
  })
})
