import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

import { persistMetadataCorrectionNoOpAuditLog } from '../persistMetadataCorrectionNoOpAuditLog'

vi.mock('@/shared/documentDbClient', () => ({
  getMetadataCorrectionAuditCollection: vi.fn()
}))

const KEYWORD_EVENT = {
  EventType: 'UPDATED',
  Scheme: 'platforms',
  UUID: 'bac2e743-1d02-4868-8bd6-b8b8741e3794',
  VersionName: '20.1',
  Timestamp: '2026-09-16T12:00:00.000Z',
  OldKeywordObject: {
    Basis: 'Platforms',
    Category: 'Space-based Platforms',
    SubCategory: 'Earth Observation Satellites',
    ShortName: 'GOSAT'
  },
  NewKeywordObject: {
    Basis: 'Platforms',
    Category: 'Space-based Platforms',
    SubCategory: 'Earth Observation Satellites',
    ShortName: 'GOSAT - Test1'
  }
}

describe('persistMetadataCorrectionNoOpAuditLog', () => {
  let collection

  beforeEach(() => {
    vi.clearAllMocks()
    collection = {
      updateOne: vi.fn().mockResolvedValue({ upsertedCount: 1 })
    }

    vi.mocked(getMetadataCorrectionAuditCollection).mockResolvedValue(collection)
  })

  test('stores a retry-safe no-collections-found audit record', async () => {
    const result = await persistMetadataCorrectionNoOpAuditLog({
      keywordEvent: KEYWORD_EVENT,
      messageId: 'sqs-message-1',
      publisherMessageId: 'sns-message-1',
      timestamp: '2026-09-16T12:01:00.000Z'
    })

    expect(result).toEqual({
      runId: expect.any(String),
      status: 'checked',
      created: true
    })

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: result.runId },
      {
        $set: expect.objectContaining({
          recordType: 'publisherEventNoOp',
          collectionCount: 0,
          publishedVersionName: '20.1',
          outcome: 'no-collections-found',
          status: 'checked',
          trigger: {
            eventType: 'UPDATED',
            scheme: 'platforms',
            keywordConceptUuid: 'bac2e743-1d02-4868-8bd6-b8b8741e3794',
            timestamp: '2026-09-16T12:00:00.000Z'
          },
          corrections: [{
            scheme: 'platforms',
            action: 'UPDATED',
            keywordConceptUuid: 'bac2e743-1d02-4868-8bd6-b8b8741e3794',
            oldKeywordObject: KEYWORD_EVENT.OldKeywordObject,
            newKeywordObject: KEYWORD_EVENT.NewKeywordObject,
            oldKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > GOSAT',
            newKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > GOSAT - Test1'
          }]
        }),
        $setOnInsert: {
          _id: result.runId,
          runId: result.runId,
          createdAt: new Date('2026-09-16T12:01:00.000Z'),
          statusHistory: [{
            status: 'checked',
            timestamp: new Date('2026-09-16T12:01:00.000Z'),
            outcome: 'no-collections-found'
          }]
        }
      },
      { upsert: true }
    )
  })

  test('uses the same audit id when an AWS message is retried', async () => {
    await persistMetadataCorrectionNoOpAuditLog({
      keywordEvent: KEYWORD_EVENT,
      publisherMessageId: 'sns-message-1'
    })

    await persistMetadataCorrectionNoOpAuditLog({
      keywordEvent: KEYWORD_EVENT,
      publisherMessageId: 'sns-message-1'
    })

    expect(collection.updateOne.mock.calls[0][0]).toEqual(
      collection.updateOne.mock.calls[1][0]
    )
  })

  test('uses the listener message id when the publisher message id is unavailable', async () => {
    await persistMetadataCorrectionNoOpAuditLog({
      keywordEvent: KEYWORD_EVENT,
      messageId: 'sqs-message-1'
    })

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(String) },
      expect.any(Object),
      { upsert: true }
    )
  })

  test('falls back to event content and empty paths when optional event data is unavailable', async () => {
    const keywordEvent = {
      EventType: 'DELETED',
      Scheme: 'platforms',
      UUID: 'bac2e743-1d02-4868-8bd6-b8b8741e3794'
    }

    await persistMetadataCorrectionNoOpAuditLog({ keywordEvent })

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(String) },
      {
        $set: expect.objectContaining({
          publishedVersionName: null,
          corrections: [{
            scheme: 'platforms',
            action: 'DELETED',
            keywordConceptUuid: 'bac2e743-1d02-4868-8bd6-b8b8741e3794',
            oldKeywordPath: '',
            newKeywordPath: ''
          }]
        }),
        $setOnInsert: expect.any(Object)
      },
      { upsert: true }
    )
  })

  test('requires a publisher keyword event', async () => {
    await expect(persistMetadataCorrectionNoOpAuditLog({})).rejects.toThrow(
      'Missing keywordEvent for metadata correction no-op audit persistence'
    )

    expect(getMetadataCorrectionAuditCollection).not.toHaveBeenCalled()
  })
})
