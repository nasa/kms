import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'

import {
  getMetadataCorrectionAuditByRunId,
  getMetadataCorrectionAuditLog
} from '../getMetadataCorrectionAuditLog'

vi.mock('@/shared/documentDbClient', () => ({
  getMetadataCorrectionAuditCollection: vi.fn()
}))

const SUMMARY_PROJECTION = {
  _id: 1,
  runId: 1,
  collectionConceptId: 1,
  collectionUri: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
  'corrections.scheme': 1,
  'corrections.action': 1,
  'corrections.oldKeywordPath': 1,
  'corrections.newKeywordPath': 1,
  'error.message': 1
}

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
    const updatedAt = new Date('2026-09-02T12:01:00.000Z')
    mongoCursor.toArray.mockResolvedValue([{
      _id: 'run-1',
      runId: 'run-1',
      collectionConceptId: 'C123-PROV',
      collectionUri: 'https://cmr.example.com/search/concepts/C123-PROV',
      createdAt,
      updatedAt,
      status: 'failed',
      corrections: [{
        scheme: 'platforms',
        action: 'replace',
        oldKeywordPath: 'Platforms > GOSAT',
        newKeywordPath: 'Platforms > GOSAT - Test1'
      }],
      metadataDiff: { changed: true },
      error: { message: 'CMR writeback timed out' }
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

    expect(collection.find).toHaveBeenCalledWith(
      {
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
      },
      { projection: SUMMARY_PROJECTION }
    )

    expect(mongoCursor.sort).toHaveBeenCalledWith({
      createdAt: -1,
      _id: -1
    })

    expect(mongoCursor.limit).toHaveBeenCalledWith(26)
    expect(result).toEqual({
      items: [{
        runId: 'run-1',
        collectionConceptId: 'C123-PROV',
        collectionUri: 'https://cmr.example.com/search/concepts/C123-PROV',
        status: 'failed',
        updatedAt,
        changes: [{
          scheme: 'platforms',
          action: 'replace',
          oldKeywordPath: 'Platforms > GOSAT',
          newKeywordPath: 'Platforms > GOSAT - Test1'
        }],
        errorMessage: 'CMR writeback timed out'
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

    expect(collection.find).toHaveBeenLastCalledWith(
      {
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
      },
      { projection: SUMMARY_PROJECTION }
    )
  })

  test('includes native metadata diffs in list results when requested', async () => {
    const metadataDiff = {
      changed: true,
      format: 'unified',
      patch: '-old\n+new'
    }
    mongoCursor.toArray.mockResolvedValue([{
      _id: 'run-1',
      runId: 'run-1',
      metadataDiff
    }])

    const result = await getMetadataCorrectionAuditLog({ includeDiff: 'true' })

    expect(collection.find).toHaveBeenCalledWith({}, {
      projection: {
        ...SUMMARY_PROJECTION,
        metadataDiff: 1
      }
    })

    expect(result.items[0]).toMatchObject({
      runId: 'run-1',
      metadataDiff
    })
  })

  test('supports default filters, one-sided date ranges, and lowercase scheme storage', async () => {
    await getMetadataCorrectionAuditLog()

    expect(collection.find).toHaveBeenLastCalledWith(
      {},
      { projection: SUMMARY_PROJECTION }
    )

    expect(mongoCursor.limit).toHaveBeenLastCalledWith(101)

    await getMetadataCorrectionAuditLog({ scheme: 'PLATFORMS' })
    expect(collection.find).toHaveBeenLastCalledWith(
      {
        $or: [
          { 'corrections.scheme': 'platforms' },
          { 'trigger.scheme': 'platforms' }
        ]
      },
      { projection: SUMMARY_PROJECTION }
    )

    await getMetadataCorrectionAuditLog({ startDate: '2026-09-01' })
    expect(collection.find).toHaveBeenLastCalledWith(
      { createdAt: { $gte: new Date('2026-09-01') } },
      { projection: SUMMARY_PROJECTION }
    )

    await getMetadataCorrectionAuditLog({ endDate: '2026-09-03' })
    expect(collection.find).toHaveBeenLastCalledWith(
      { createdAt: { $lte: new Date('2026-09-03') } },
      { projection: SUMMARY_PROJECTION }
    )
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

    await expect(getMetadataCorrectionAuditLog({
      includeDiff: 'yes'
    })).rejects.toThrow(
      'Invalid metadata correction audit includeDiff: expected true or false'
    )

    const invalidPaginationToken = Buffer.from(JSON.stringify({
      createdAt: '2026-09-02T12:00:00.000Z',
      runId: ''
    })).toString('base64url')
    await expect(getMetadataCorrectionAuditLog({
      paginationToken: invalidPaginationToken
    })).rejects.toThrow('Invalid metadata correction audit paginationToken')

    expect(getMetadataCorrectionAuditCollection).not.toHaveBeenCalled()
  })

  test('returns one detailed audit run without the native metadata diff by default', async () => {
    collection.findOne.mockResolvedValue({
      runId: 'run-1',
      status: 'applied'
    })

    await expect(getMetadataCorrectionAuditByRunId({
      runId: 'run-1'
    })).resolves.toEqual({
      runId: 'run-1',
      status: 'applied'
    })

    expect(collection.findOne).toHaveBeenCalledWith(
      { _id: 'run-1' },
      {
        projection: {
          _id: 0,
          metadataDiff: 0
        }
      }
    )
  })

  test('includes the native metadata diff only when requested', async () => {
    collection.findOne.mockResolvedValue({
      runId: 'run-1',
      status: 'failed',
      metadataDiff: {
        changed: true,
        patch: '-old\n+new'
      }
    })

    const result = await getMetadataCorrectionAuditByRunId({
      runId: 'run-1',
      includeDiff: 'true'
    })

    expect(result.metadataDiff.patch).toBe('-old\n+new')
    expect(collection.findOne).toHaveBeenCalledWith(
      { _id: 'run-1' },
      { projection: { _id: 0 } }
    )
  })

  test('returns null for an unknown run and validates detail parameters', async () => {
    await expect(getMetadataCorrectionAuditByRunId({
      runId: 'missing-run'
    })).resolves.toBeNull()

    await expect(getMetadataCorrectionAuditByRunId()).rejects.toThrow(
      'Invalid metadata correction audit runId'
    )

    await expect(getMetadataCorrectionAuditByRunId({
      runId: 'run-1',
      includeDiff: 'yes'
    })).rejects.toThrow(
      'Invalid metadata correction audit includeDiff: expected true or false'
    )
  })
})
