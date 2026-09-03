import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

import { persistMetadataCorrectionAuditLog } from '../persistMetadataCorrectionAuditLog'

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-run-id')
}))

vi.mock('@/shared/documentDbClient', () => ({
  getMetadataCorrectionAuditCollection: vi.fn()
}))

const buildCorrection = () => ({
  scheme: 'platforms',
  keywordConceptUuid: 'platform-uuid',
  oldKeywordObject: {
    Basis: 'Platforms',
    Category: 'Space-based Platforms',
    SubCategory: 'Earth Observation Satellites',
    ShortName: 'GOSAT'
  },
  newKeywordObject: {
    Basis: 'Platforms',
    Category: 'Space-based Platforms',
    SubCategory: 'Earth Observation Satellites',
    ShortName: 'GOSAT - Test1'
  }
})

describe('persistMetadataCorrectionAuditLog', () => {
  let collection

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CMR_BASE_URL = 'https://cmr.example.com/'
    collection = {
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true })
    }

    vi.mocked(getMetadataCorrectionAuditCollection).mockResolvedValue(collection)
  })

  afterEach(() => {
    delete process.env.CMR_BASE_URL
  })

  test('creates one checked audit document with corrections and status history', async () => {
    const result = await persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C123-PROV',
      corrections: [buildCorrection()],
      keywordEvent: {
        eventType: 'UPDATED',
        scheme: 'platforms',
        uuid: 'platform-uuid'
      },
      nativeFormat: 'UMM',
      priorRevisionId: 7,
      providerId: 'PROV',
      publishedVersionName: '20.1',
      status: 'checked',
      timestamp: '2026-09-02T12:00:00.000Z'
    })

    expect(result).toEqual({
      runId: 'generated-run-id',
      status: 'checked',
      created: true
    })

    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: 'generated-run-id' },
      expect.objectContaining({
        $set: expect.objectContaining({
          collectionConceptId: 'C123-PROV',
          collectionUri: 'https://cmr.example.com/search/concepts/C123-PROV',
          publishedVersionName: '20.1',
          priorRevisionId: 7,
          status: 'checked',
          corrections: [expect.objectContaining({
            keywordConceptUuid: 'platform-uuid',
            oldKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > GOSAT',
            newKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > GOSAT - Test1'
          })]
        }),
        $setOnInsert: {
          _id: 'generated-run-id',
          runId: 'generated-run-id',
          createdAt: new Date('2026-09-02T12:00:00.000Z')
        },
        $push: {
          statusHistory: {
            status: 'checked',
            timestamp: new Date('2026-09-02T12:00:00.000Z')
          }
        },
        $unset: { error: '' }
      }),
      { upsert: true }
    )
  })

  test('omits the collection URI when the CMR base URL is not configured', async () => {
    delete process.env.CMR_BASE_URL

    await persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C123-PROV'
    })

    expect(collection.updateOne.mock.calls[0][1].$set).not.toHaveProperty('collectionUri')
  })

  test('updates the same run to failed and records structured error details', async () => {
    collection.findOne.mockResolvedValue({ status: 'pending' })
    const error = Object.assign(new Error('CMR rejected metadata'), {
      status: 400,
      cmrResponseBody: { errors: ['invalid'] }
    })

    await persistMetadataCorrectionAuditLog({
      runId: 'run-1',
      collectionConceptId: 'C123-PROV',
      error,
      outcome: 'writeback-failed',
      status: 'failed',
      timestamp: '2026-09-02T12:01:00.000Z'
    })

    const update = collection.updateOne.mock.calls[0][1]
    expect(update.$set).toEqual(expect.objectContaining({
      status: 'failed',
      outcome: 'writeback-failed',
      error: {
        message: 'CMR rejected metadata',
        status: 400,
        cmrResponseBody: { errors: ['invalid'] }
      }
    }))

    expect(update.$push.statusHistory).toEqual({
      status: 'failed',
      timestamp: new Date('2026-09-02T12:01:00.000Z'),
      outcome: 'writeback-failed',
      error: 'CMR rejected metadata'
    })

    expect(update.$unset).toBeUndefined()
  })

  test('does not regress pending status when a retried run is checked again', async () => {
    collection.findOne.mockResolvedValue({ status: 'pending' })

    const result = await persistMetadataCorrectionAuditLog({
      runId: 'run-1',
      collectionConceptId: 'C123-PROV',
      status: 'checked'
    })

    expect(result.status).toBe('pending')
    const update = collection.updateOne.mock.calls[0][1]
    expect(update.$set.status).toBe('pending')
    expect(update.$set['timestamps.pendingAt']).toBeUndefined()
    expect(update.$push).toBeUndefined()
  })

  test('does not update an applied run during a retry', async () => {
    collection.findOne.mockResolvedValue({ status: 'applied' })

    await expect(persistMetadataCorrectionAuditLog({
      runId: 'run-1',
      collectionConceptId: 'C123-PROV',
      status: 'checked'
    })).resolves.toEqual({
      runId: 'run-1',
      status: 'applied',
      created: false
    })

    expect(collection.updateOne).not.toHaveBeenCalled()
  })

  test('allows a failed run to restart and clears its previous error', async () => {
    collection.findOne.mockResolvedValue({ status: 'failed' })

    const result = await persistMetadataCorrectionAuditLog({
      runId: 'run-1',
      collectionConceptId: 'C123-PROV',
      status: 'checked'
    })

    expect(result.status).toBe('checked')
    expect(collection.updateOne.mock.calls[0][1]).toEqual(expect.objectContaining({
      $unset: { error: '' },
      $push: expect.objectContaining({
        statusHistory: expect.objectContaining({ status: 'checked' })
      })
    }))
  })

  test('validates required fields and lifecycle status', async () => {
    await expect(persistMetadataCorrectionAuditLog({
      status: 'checked'
    })).rejects.toThrow('Missing collectionConceptId')

    await expect(persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C123-PROV',
      status: 'unknown'
    })).rejects.toThrow('Invalid metadata correction audit status: unknown')

    expect(getMetadataCorrectionAuditCollection).not.toHaveBeenCalled()
  })
})
