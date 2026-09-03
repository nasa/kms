import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

import { getMetadataCorrectionAuditLog } from '../getMetadataCorrectionAuditLog'

vi.mock('@/shared/documentDbClient', () => ({
  getMetadataCorrectionAuditCollection: vi.fn()
}))

describe('metadata correction audit queries', () => {
  let collection
  let mongoCursor

  beforeEach(() => {
    vi.clearAllMocks()
    mongoCursor = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([])
    }

    collection = {
      find: vi.fn().mockReturnValue(mongoCursor),
      findOne: vi.fn().mockResolvedValue(null)
    }

    vi.mocked(getMetadataCorrectionAuditCollection).mockResolvedValue(collection)
  })

  test('filters and returns newest-first audit documents', async () => {
    const createdAt = new Date('2026-09-02T12:00:00.000Z')
    mongoCursor.toArray.mockResolvedValue([{
      _id: 'run-1',
      runId: 'run-1',
      collectionConceptId: 'C123-PROV',
      createdAt,
      status: 'applied'
    }])

    const result = await getMetadataCorrectionAuditLog({
      action: 'updated',
      collectionConceptId: 'C123-PROV',
      endDate: '2026-09-03',
      keywordConceptUuid: 'keyword-1',
      limit: '25',
      nativeFormat: 'UMM',
      publishedVersionName: '20.1',
      scheme: 'dataformat',
      source: 'cmrKeywordEventsListener',
      startDate: '2026-09-01',
      status: 'applied'
    })

    expect(collection.find).toHaveBeenCalledWith({
      $and: [
        {
          collectionConceptId: 'C123-PROV',
          'trigger.eventType': 'UPDATED',
          nativeFormat: 'UMM',
          publishedVersionName: '20.1',
          source: 'cmrKeywordEventsListener',
          status: 'applied',
          createdAt: {
            $gte: new Date('2026-09-01'),
            $lte: new Date('2026-09-03')
          }
        },
        {
          $or: [
            { 'corrections.keywordConceptUuid': 'keyword-1' },
            { 'trigger.keywordConceptUuid': 'keyword-1' }
          ]
        },
        {
          $or: [
            { 'corrections.scheme': { $in: ['DataFormat', 'dataformat'] } },
            { 'trigger.scheme': { $in: ['DataFormat', 'dataformat'] } }
          ]
        }
      ]
    })

    expect(mongoCursor.sort).toHaveBeenCalledWith({
      createdAt: -1,
      _id: -1
    })

    expect(mongoCursor.limit).toHaveBeenCalledWith(26)
    expect(result).toEqual({
      items: [{
        runId: 'run-1',
        collectionConceptId: 'C123-PROV',
        createdAt,
        status: 'applied'
      }],
      nextPaginationToken: null
    })
  })

  test('returns a pagination token when another page exists and applies it to the next query', async () => {
    const documents = [
      {
        _id: 'run-3',
        runId: 'run-3',
        createdAt: new Date('2026-09-03')
      },
      {
        _id: 'run-2',
        runId: 'run-2',
        createdAt: new Date('2026-09-02')
      },
      {
        _id: 'run-1',
        runId: 'run-1',
        createdAt: new Date('2026-09-01')
      }
    ]
    mongoCursor.toArray.mockResolvedValue(documents)

    const firstPage = await getMetadataCorrectionAuditLog({ limit: '2' })

    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.nextPaginationToken).toEqual(expect.any(String))

    mongoCursor.toArray.mockResolvedValue([])
    await getMetadataCorrectionAuditLog({
      paginationToken: firstPage.nextPaginationToken,
      limit: '2',
      status: 'checked'
    })

    expect(collection.find).toHaveBeenLastCalledWith({
      $and: [
        { status: 'checked' },
        {
          $or: [
            { createdAt: { $lt: new Date('2026-09-02') } },
            {
              createdAt: new Date('2026-09-02'),
              _id: { $lt: 'run-2' }
            }
          ]
        }
      ]
    })
  })

  test('supports default filters, one-sided date ranges, and lowercase scheme storage', async () => {
    await getMetadataCorrectionAuditLog()

    expect(collection.find).toHaveBeenLastCalledWith({})
    expect(mongoCursor.limit).toHaveBeenLastCalledWith(101)

    await getMetadataCorrectionAuditLog({ scheme: 'PLATFORMS' })
    expect(collection.find).toHaveBeenLastCalledWith({
      $or: [
        { 'corrections.scheme': 'platforms' },
        { 'trigger.scheme': 'platforms' }
      ]
    })

    await getMetadataCorrectionAuditLog({ startDate: '2026-09-01' })
    expect(collection.find).toHaveBeenLastCalledWith({
      createdAt: { $gte: new Date('2026-09-01') }
    })

    await getMetadataCorrectionAuditLog({ endDate: '2026-09-03' })
    expect(collection.find).toHaveBeenLastCalledWith({
      createdAt: { $lte: new Date('2026-09-03') }
    })
  })

  test('validates filters before querying DocumentDB', async () => {
    await expect(getMetadataCorrectionAuditLog({
      status: 'unknown'
    })).rejects.toThrow('Invalid metadata correction audit status: unknown')

    await expect(getMetadataCorrectionAuditLog({
      startDate: 'not-a-date'
    })).rejects.toThrow('Invalid metadata correction audit startDate')

    await expect(getMetadataCorrectionAuditLog({
      action: 'renamed'
    })).rejects.toThrow('Invalid metadata correction audit action: renamed')

    await expect(getMetadataCorrectionAuditLog({
      scheme: 'not-a-scheme'
    })).rejects.toThrow('Invalid metadata correction audit scheme: not-a-scheme')

    await expect(getMetadataCorrectionAuditLog({
      limit: '5000'
    })).rejects.toThrow('Invalid metadata correction audit limit: expected an integer from 1 to 250')

    await expect(getMetadataCorrectionAuditLog({
      limit: '12records'
    })).rejects.toThrow('Invalid metadata correction audit limit: expected an integer from 1 to 250')

    await expect(getMetadataCorrectionAuditLog({
      startDate: '2026-09-03',
      endDate: '2026-09-01'
    })).rejects.toThrow(
      'Invalid metadata correction audit date range: startDate must not be after endDate'
    )

    await expect(getMetadataCorrectionAuditLog({
      paginationToken: 'not-a-pagination-token'
    })).rejects.toThrow('Invalid metadata correction audit paginationToken')

    const invalidPaginationToken = Buffer.from(JSON.stringify({
      createdAt: '2026-09-02T12:00:00.000Z',
      runId: ''
    })).toString('base64url')
    await expect(getMetadataCorrectionAuditLog({
      paginationToken: invalidPaginationToken
    })).rejects.toThrow('Invalid metadata correction audit paginationToken')

    expect(getMetadataCorrectionAuditCollection).not.toHaveBeenCalled()
  })
})
