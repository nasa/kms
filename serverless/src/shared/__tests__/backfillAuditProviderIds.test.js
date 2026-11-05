import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  getDatabaseMigrationsCollection,
  getMetadataCorrectionAuditCollection
} from '../documentDbClient'
import { backfillAuditProviderIds } from '../migrations/backfillAuditProviderIds'

vi.mock('../documentDbClient', () => ({
  getMetadataCorrectionAuditCollection: vi.fn(),
  getDatabaseMigrationsCollection: vi.fn()
}))

describe('backfillAuditProviderIds', () => {
  let documents
  let cursor
  let collection
  let migrations
  const id = '2026-10-29-backfill-audit-provider-ids'

  beforeEach(() => {
    vi.resetAllMocks()
    documents = []
    cursor = {
      batchSize: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
      [Symbol.asyncIterator]: () => {
        const remaining = [...documents]

        return {
          next: async () => (remaining.length ? {
            value: remaining.shift(),
            done: false
          } : { done: true })
        }
      }
    }

    collection = {
      find: vi.fn().mockReturnValue(cursor),
      bulkWrite: vi.fn(async (operations) => ({ modifiedCount: operations.length }))
    }

    vi.mocked(getMetadataCorrectionAuditCollection).mockResolvedValue(collection)
    migrations = {
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 })
    }

    vi.mocked(getDatabaseMigrationsCollection).mockResolvedValue(migrations)
  })

  test('backfills valid collection IDs and skips unparseable ones', async () => {
    documents = [
      {
        _id: 'a',
        collectionConceptId: 'C123-SCIOPS'
      },
      {
        _id: 'b',
        collectionConceptId: 'C124-edf_dev01'
      },
      {
        _id: 'c',
        collectionConceptId: 'C125-PROVIDER-WITH-HYPHENS'
      },
      {
        _id: 'd',
        collectionConceptId: 'not-a-concept-id'
      },
      {
        _id: 'e',
        collectionConceptId: 'C126-'
      }
    ]

    await expect(backfillAuditProviderIds()).resolves.toHaveProperty('result', {
      scannedCount: 5,
      updatedCount: 3,
      skippedCount: 2
    })

    expect(collection.find).toHaveBeenCalledWith({
      providerId: { $in: [null, ''] },
      collectionConceptId: { $type: 'string' }
    }, {
      projection: {
        _id: 1,
        collectionConceptId: 1
      }
    })

    expect(collection.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: {
            _id: 'a',
            providerId: { $in: [null, ''] }
          },
          update: { $set: { providerId: 'SCIOPS' } }
        }
      },
      {
        updateOne: {
          filter: {
            _id: 'b',
            providerId: { $in: [null, ''] }
          },
          update: { $set: { providerId: 'EDF_DEV01' } }
        }
      },
      {
        updateOne: {
          filter: {
            _id: 'c',
            providerId: { $in: [null, ''] }
          },
          update: { $set: { providerId: 'PROVIDER-WITH-HYPHENS' } }
        }
      }
    ], { ordered: false })

    expect(cursor.close).toHaveBeenCalledOnce()
    expect(migrations.updateOne).toHaveBeenLastCalledWith({ _id: id }, {
      $set: {
        status: 'completed',
        completedAt: expect.any(Date),
        updatedAt: expect.any(Date),
        result: {
          scannedCount: 5,
          updatedCount: 3,
          skippedCount: 2
        }
      }
    })
  })

  test('writes bounded batches and does not update audit lifecycle fields', async () => {
    documents = Array.from({ length: 501 }, (_, index) => ({
      _id: String(index),
      collectionConceptId: `C${index}-SCIOPS`
    }))

    await expect(backfillAuditProviderIds()).resolves.toHaveProperty('result', {
      scannedCount: 501,
      updatedCount: 501,
      skippedCount: 0
    })

    expect(cursor.batchSize).toHaveBeenCalledWith(500)
    expect(collection.bulkWrite.mock.calls.map(([operations]) => operations.length))
      .toEqual([500, 1])

    expect(collection.bulkWrite.mock.calls[0][0][0].updateOne.update)
      .toEqual({ $set: { providerId: 'SCIOPS' } })
  })

  test('does not write when no candidates exist', async () => {
    await expect(backfillAuditProviderIds()).resolves.toHaveProperty('result', {
      scannedCount: 0,
      updatedCount: 0,
      skippedCount: 0
    })

    expect(collection.bulkWrite).not.toHaveBeenCalled()
    expect(cursor.close).toHaveBeenCalledOnce()
  })

  test('does not overwrite a provider populated concurrently after the candidate scan', async () => {
    documents = [{
      _id: 'a',
      collectionConceptId: 'C123-SCIOPS'
    }]

    collection.bulkWrite.mockResolvedValue({ modifiedCount: 0 })

    await expect(backfillAuditProviderIds()).resolves.toHaveProperty('result', {
      scannedCount: 1,
      updatedCount: 0,
      skippedCount: 1
    })

    expect(collection.bulkWrite.mock.calls[0][0][0].updateOne.filter)
      .toEqual({
        _id: 'a',
        providerId: { $in: [null, ''] }
      })
  })

  test('closes the cursor and propagates a batch failure so deployment can resume safely later', async () => {
    documents = [{
      _id: 'a',
      collectionConceptId: 'C123-SCIOPS'
    }]

    collection.bulkWrite.mockRejectedValue(new Error('bulk write failed'))

    await expect(backfillAuditProviderIds()).rejects.toThrow('bulk write failed')

    expect(cursor.close).toHaveBeenCalledOnce()
    expect(migrations.updateOne.mock.calls.at(-1)[1].$set).toMatchObject({
      status: 'failed',
      error: { message: 'bulk write failed' }
    })
  })

  test('closes the cursor when reading candidates fails', async () => {
    cursor[Symbol.asyncIterator] = () => ({ next: async () => { throw new Error('read failed') } })

    await expect(backfillAuditProviderIds()).rejects.toThrow('read failed')

    expect(cursor.close).toHaveBeenCalledOnce()
    expect(collection.bulkWrite).not.toHaveBeenCalled()
  })

  test('skips completed migrations without reading or updating audit data', async () => {
    migrations.findOne.mockResolvedValue({ status: 'completed' })

    await expect(backfillAuditProviderIds()).resolves.toEqual({
      id,
      skipped: true
    })

    expect(getMetadataCorrectionAuditCollection).not.toHaveBeenCalled()
    expect(migrations.updateOne).not.toHaveBeenCalled()
  })

  test('resumes failed work and records another attempt', async () => {
    migrations.findOne.mockResolvedValue({
      status: 'failed',
      attempts: 1
    })

    await expect(backfillAuditProviderIds()).resolves.toMatchObject({
      id,
      skipped: false
    })

    expect(migrations.updateOne.mock.calls[0][1]).toMatchObject({
      $set: { status: 'running' },
      $inc: { attempts: 1 }
    })

    expect(migrations.updateOne.mock.calls.at(-1)[1].$set.status).toBe('completed')
  })

  test('resumes a running marker left by an interrupted initializer invocation', async () => {
    migrations.findOne.mockResolvedValue({ status: 'running' })
    documents = [{
      _id: 'a',
      collectionConceptId: 'C123-SCIOPS'
    }]

    await expect(backfillAuditProviderIds()).resolves.toHaveProperty('result', {
      scannedCount: 1,
      updatedCount: 1,
      skippedCount: 0
    })
  })

  test('records non-Error failures and propagates them to deployment', async () => {
    vi.mocked(getMetadataCorrectionAuditCollection).mockRejectedValue(null)

    await expect(backfillAuditProviderIds()).rejects.toBeNull()

    expect(migrations.updateOne.mock.calls.at(-1)[1].$set.error).toEqual({ message: 'null' })
  })
})
