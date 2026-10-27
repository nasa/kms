import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

import {
  persistMetadataCorrectionWorkflowFailureAuditLog
} from '../persistMetadataCorrectionWorkflowFailureAuditLog'

vi.mock('@/shared/documentDbClient', () => ({
  getMetadataCorrectionAuditCollection: vi.fn()
}))

describe('persistMetadataCorrectionWorkflowFailureAuditLog', () => {
  let collection

  beforeEach(() => {
    vi.clearAllMocks()
    collection = {
      updateOne: vi.fn().mockResolvedValue({ upsertedCount: 1 })
    }

    vi.mocked(getMetadataCorrectionAuditCollection).mockResolvedValue(collection)
  })

  test('stores a failed keyword event with readable correction paths', async () => {
    const error = Object.assign(new Error('SNS unavailable'), {
      status: 503
    })
    const result = await persistMetadataCorrectionWorkflowFailureAuditLog({
      source: 'publisher',
      outcome: 'keyword-event-publish-failed',
      error,
      keywordEvent: {
        EventType: 'UPDATED',
        Scheme: 'platforms',
        UUID: 'platform-uuid',
        OldKeywordObject: {
          Basis: 'Space-based Platforms',
          Category: 'Earth Observation Satellites',
          SubCategory: '',
          ShortName: 'OLD'
        },
        NewKeywordObject: {
          Basis: 'Space-based Platforms',
          Category: 'Earth Observation Satellites',
          SubCategory: '',
          ShortName: 'NEW'
        },
        Timestamp: '2026-10-21T12:00:00.000Z'
      },
      publishedVersionName: '25.0D',
      timestamp: '2026-10-21T12:01:00.000Z'
    })

    expect(result).toEqual({
      runId: expect.any(String),
      status: 'failed',
      created: true
    })

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: result.runId },
      expect.objectContaining({
        $set: expect.objectContaining({
          recordType: 'metadataCorrectionWorkflowFailure',
          publishedVersionName: '25.0D',
          source: 'publisher',
          outcome: 'keyword-event-publish-failed',
          status: 'failed',
          trigger: {
            eventType: 'UPDATED',
            scheme: 'platforms',
            keywordConceptUuid: 'platform-uuid',
            timestamp: '2026-10-21T12:00:00.000Z'
          },
          corrections: [expect.objectContaining({
            oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > OLD',
            newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > NEW'
          })],
          error: {
            message: 'SNS unavailable',
            status: 503
          }
        })
      }),
      { upsert: true }
    )
  })

  test('stores a malformed request failure without keyword-event context', async () => {
    await persistMetadataCorrectionWorkflowFailureAuditLog({
      source: 'metadataCorrectionService',
      outcome: 'invalid-correction-request',
      error: new SyntaxError('Unexpected token'),
      messageId: 'message-123'
    })

    const setFields = collection.updateOne.mock.calls[0][1].$set
    expect(setFields).not.toHaveProperty('trigger')
    expect(setFields).not.toHaveProperty('corrections')
    expect(setFields).toEqual(expect.objectContaining({
      messageId: 'message-123',
      status: 'failed',
      outcome: 'invalid-correction-request'
    }))
  })

  test('stores lowercase event fields, missing paths, and a non-Error failure', async () => {
    collection.updateOne.mockResolvedValue({ upsertedCount: 0 })

    const result = await persistMetadataCorrectionWorkflowFailureAuditLog({
      source: 'cmrKeywordEventsListener',
      outcome: 'keyword-event-processing-failed',
      error: 'CMR unavailable',
      publisherMessageId: 'publisher-message',
      messageId: 'queue-message',
      keywordEvent: {
        eventType: 'DELETED',
        scheme: 'dataformat',
        uuid: 'format-uuid',
        publishedVersionName: '25.0D',
        timestamp: '2026-10-27T12:00:00.000Z'
      },
      timestamp: '2026-10-27T12:01:00.000Z'
    })

    expect(result.created).toBe(false)
    expect(collection.updateOne.mock.calls[0][1].$set).toMatchObject({
      publishedVersionName: '25.0D',
      publisherMessageId: 'publisher-message',
      messageId: 'queue-message',
      trigger: {
        eventType: 'DELETED',
        scheme: 'dataformat',
        keywordConceptUuid: 'format-uuid',
        timestamp: '2026-10-27T12:00:00.000Z'
      },
      corrections: [{
        scheme: 'dataformat',
        action: 'DELETED',
        keywordConceptUuid: 'format-uuid',
        oldKeywordPath: '',
        newKeywordPath: ''
      }],
      error: { message: 'CMR unavailable' },
      updatedAt: new Date('2026-10-27T12:01:00.000Z')
    })
  })

  test('omits error details when no error value was supplied', async () => {
    await persistMetadataCorrectionWorkflowFailureAuditLog({
      source: 'publisher',
      outcome: 'keyword-event-publish-failed',
      messageId: 'message-without-error',
      keywordEvent: { VersionName: '25.0D' },
      timestamp: '2026-10-27T12:00:00.000Z'
    })

    const update = collection.updateOne.mock.calls[0][1]

    expect(update.$set).not.toHaveProperty('error')
    expect(update.$set.publishedVersionName).toBe('25.0D')
    expect(update.$setOnInsert.statusHistory).toEqual([{
      status: 'failed',
      timestamp: new Date('2026-10-27T12:00:00.000Z'),
      outcome: 'keyword-event-publish-failed'
    }])
  })

  test('reuses the same audit id for redeliveries of the original publisher message', async () => {
    const failure = {
      source: 'cmrKeywordEventsListener',
      outcome: 'keyword-event-processing-failed',
      publisherMessageId: 'original-publisher-message',
      publishedVersionName: '25.0D',
      error: new Error('CMR unavailable')
    }
    const first = await persistMetadataCorrectionWorkflowFailureAuditLog({
      ...failure,
      messageId: 'first-delivery'
    })
    const second = await persistMetadataCorrectionWorkflowFailureAuditLog({
      ...failure,
      messageId: 'second-delivery'
    })

    expect(second.runId).toBe(first.runId)
    expect(collection.updateOne.mock.calls[0][0]).toEqual({ _id: first.runId })
    expect(collection.updateOne.mock.calls[1][0]).toEqual({ _id: first.runId })
  })

  test('propagates audit persistence failures to the caller', async () => {
    const error = new Error('DocumentDB unavailable')
    collection.updateOne.mockRejectedValue(error)

    await expect(persistMetadataCorrectionWorkflowFailureAuditLog({
      source: 'publisher',
      outcome: 'keyword-event-publish-failed',
      messageId: 'message-123',
      error: new Error('SNS unavailable')
    })).rejects.toBe(error)
  })
})
