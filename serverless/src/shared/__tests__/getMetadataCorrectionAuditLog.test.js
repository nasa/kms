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
              oldKeywordPath: { value: 'OLD PATH' },
              newKeywordPath: { value: 'NEW PATH' },
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
        oldKeywordPath: 'OLD PATH',
        newKeywordPath: 'NEW PATH',
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
})
