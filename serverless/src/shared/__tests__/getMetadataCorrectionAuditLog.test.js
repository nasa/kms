import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { getMetadataCorrectionAuditLog } from '../getMetadataCorrectionAuditLog'

vi.mock('@/shared/sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('getMetadataCorrectionAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('queries the audit graph and maps bindings into audit rows', async () => {
    vi.mocked(sparqlRequest).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              record: { value: 'https://gcmd.earthdata.nasa.gov/kms/metadata-correction-audit/audit-1' },
              timestamp: { value: '2026-05-06T18:00:00.000Z' },
              publishedVersionName: { value: '9.1.5' },
              collectionConceptId: { value: 'C1234567890-LOCAL' },
              keywordConceptUuid: { value: 'uuid-1' },
              scheme: { value: 'sciencekeywords' },
              action: { value: 'UPDATED' },
              oldKeywordPath: { value: 'EARTH SCIENCE > ATMOSPHERE' },
              newKeywordPath: { value: 'EARTH SCIENCE > OCEANS' },
              nativeFormat: { value: 'UMM' },
              delegateName: { value: 'umm' },
              status: { value: 'pending' },
              triggerScheme: { value: 'sciencekeywords' },
              triggerKeywordUuid: { value: 'uuid-trigger' }
            }
          ]
        }
      })
    })

    const result = await getMetadataCorrectionAuditLog({
      collectionConceptId: 'C1234567890-LOCAL',
      action: 'UPDATED',
      status: 'pending',
      limit: '25'
    })

    expect(result).toEqual([
      {
        recordUri: 'https://gcmd.earthdata.nasa.gov/kms/metadata-correction-audit/audit-1',
        timestamp: '2026-05-06T18:00:00.000Z',
        publishedVersionName: '9.1.5',
        collectionConceptId: 'C1234567890-LOCAL',
        keywordConceptUuid: 'uuid-1',
        scheme: 'sciencekeywords',
        action: 'UPDATED',
        oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE',
        newKeywordPath: 'EARTH SCIENCE > OCEANS',
        nativeFormat: 'UMM',
        delegateName: 'umm',
        status: 'pending',
        triggerScheme: 'sciencekeywords',
        triggerKeywordUuid: 'uuid-trigger'
      }
    ])

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      body: expect.stringContaining('GRAPH <https://gcmd.earthdata.nasa.gov/kms/audit/metadata-corrections>'),
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json'
    })

    const sparqlCall = vi.mocked(sparqlRequest).mock.calls[0][0]
    expect(sparqlCall.body).toContain('FILTER(?collectionConceptId = "C1234567890-LOCAL")')
    expect(sparqlCall.body).toContain('FILTER(?action = "UPDATED")')
    expect(sparqlCall.body).toContain('FILTER(?status = "pending")')
    expect(sparqlCall.body).toContain('LIMIT 25')
  })

  test('normalizes invalid limits, applies keyword and scheme filters, and leaves optional fields undefined when absent', async () => {
    vi.mocked(sparqlRequest).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              record: { value: 'https://gcmd.earthdata.nasa.gov/kms/metadata-correction-audit/audit-2' },
              timestamp: { value: '2026-05-07T18:00:00.000Z' },
              publishedVersionName: { value: '9.1.6' },
              collectionConceptId: { value: 'C0000000002-LOCAL' },
              keywordConceptUuid: { value: 'uuid-2' },
              scheme: { value: 'platforms' },
              action: { value: 'UPDATED' },
              oldKeywordPath: { value: 'OLD PLATFORM' },
              newKeywordPath: { value: 'NEW PLATFORM' },
              nativeFormat: { value: 'DIF10' },
              delegateName: { value: 'dif10' },
              status: { value: 'applied' }
            }
          ]
        }
      })
    })

    const result = await getMetadataCorrectionAuditLog({
      keywordConceptUuid: 'uuid-2',
      scheme: 'platforms',
      limit: 'not-a-number'
    })

    expect(result).toEqual([
      {
        recordUri: 'https://gcmd.earthdata.nasa.gov/kms/metadata-correction-audit/audit-2',
        timestamp: '2026-05-07T18:00:00.000Z',
        publishedVersionName: '9.1.6',
        collectionConceptId: 'C0000000002-LOCAL',
        keywordConceptUuid: 'uuid-2',
        scheme: 'platforms',
        action: 'UPDATED',
        oldKeywordPath: 'OLD PLATFORM',
        newKeywordPath: 'NEW PLATFORM',
        nativeFormat: 'DIF10',
        delegateName: 'dif10',
        status: 'applied',
        triggerScheme: undefined,
        triggerKeywordUuid: undefined
      }
    ])

    const sparqlCall = vi.mocked(sparqlRequest).mock.calls[0][0]
    expect(sparqlCall.body).toContain('FILTER(?keywordConceptUuid = "uuid-2")')
    expect(sparqlCall.body).toContain('FILTER(?scheme = "platforms")')
    expect(sparqlCall.body).toContain('LIMIT 100')
    expect(sparqlCall.body).not.toContain('FILTER(?collectionConceptId =')
    expect(sparqlCall.body).not.toContain('FILTER(?action =')
    expect(sparqlCall.body).not.toContain('FILTER(?status =')
  })

  test('uses default filters and returns an empty array when the query result has no bindings', async () => {
    vi.mocked(sparqlRequest).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    })

    await expect(getMetadataCorrectionAuditLog()).resolves.toEqual([])

    const sparqlCall = vi.mocked(sparqlRequest).mock.calls[0][0]
    expect(sparqlCall.body).toContain('LIMIT 100')
    expect(sparqlCall.body).not.toContain('FILTER(?collectionConceptId =')
    expect(sparqlCall.body).not.toContain('FILTER(?keywordConceptUuid =')
    expect(sparqlCall.body).not.toContain('FILTER(?scheme =')
  })
})
