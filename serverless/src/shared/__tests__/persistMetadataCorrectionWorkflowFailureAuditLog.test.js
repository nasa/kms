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
})
