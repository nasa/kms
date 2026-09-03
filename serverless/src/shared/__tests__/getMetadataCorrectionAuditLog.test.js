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
      action: 'UPDATED',
      collectionConceptId: 'C123-PROV',
      endDate: '2026-09-03',
      keywordConceptUuid: 'keyword-1',
      limit: '25',
      nativeFormat: 'UMM',
      publishedVersionName: '20.1',
      scheme: 'platforms',
      source: 'cmrKeywordEventsListener',
      startDate: '2026-09-01',
      status: 'applied'
    })

    expect(collection.find).toHaveBeenCalledWith({
      collectionConceptId: 'C123-PROV',
      'trigger.eventType': 'UPDATED',
      'corrections.keywordConceptUuid': 'keyword-1',
      nativeFormat: 'UMM',
      publishedVersionName: '20.1',
      $or: [
        { 'corrections.scheme': 'platforms' },
        { 'trigger.scheme': 'platforms' }
      ],
      source: 'cmrKeywordEventsListener',
      status: 'applied',
      createdAt: {
        $gte: new Date('2026-09-01'),
        $lte: new Date('2026-09-03')
      }
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

  test('uses bounded limits and validates filters', async () => {
    await getMetadataCorrectionAuditLog({ limit: '5000' })
    expect(mongoCursor.limit).toHaveBeenCalledWith(251)

    await expect(getMetadataCorrectionAuditLog({
      status: 'unknown'
    })).rejects.toThrow('Invalid metadata correction audit status: unknown')

    await expect(getMetadataCorrectionAuditLog({
      startDate: 'not-a-date'
    })).rejects.toThrow('Invalid metadata correction audit startDate')

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
  })
})
