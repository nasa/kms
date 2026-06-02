import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { persistMetadataCorrectionAuditLog } from '../persistMetadataCorrectionAuditLog'

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'audit-record-123')
}))

vi.mock('@/shared/getVersionMetadata', () => ({
  getVersionMetadata: vi.fn()
}))

vi.mock('@/shared/sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('persistMetadataCorrectionAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getVersionMetadata).mockResolvedValue({
      version: 'published',
      versionName: '9.1.5',
      versionType: 'published',
      created: '2026-01-01T00:00:00Z',
      lastSynced: null
    })

    vi.mocked(sparqlRequest).mockResolvedValue({ ok: true })
  })

  test('persists one audit row per correction with pending status', async () => {
    const result = await persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C1234567890-LOCAL',
      keywordEvent: {
        eventType: 'UPDATED',
        scheme: 'sciencekeywords',
        uuid: '2e5a401b-1507-4f57-82b8-36557c13b154'
      },
      nativeFormat: 'UMM',
      delegateName: 'umm',
      corrections: [
        {
          scheme: 'sciencekeywords',
          keywordConceptUuid: '2e5a401b-1507-4f57-82b8-36557c13b154',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: 'LEGACY AEROSOLS',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            PathSegments: ['Science Keywords', 'EARTH SCIENCE', 'ATMOSPHERE', 'AEROSOLS'],
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ],
      status: 'pending',
      timestamp: '2026-05-06T18:00:00.000Z'
    })

    expect(result).toEqual({
      insertedCount: 1,
      publishedVersionName: '9.1.5',
      status: 'pending'
    })

    expect(getVersionMetadata).toHaveBeenCalledWith('published')
    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      contentType: 'application/sparql-update',
      accept: 'application/json',
      body: expect.stringContaining('GRAPH <https://gcmd.earthdata.nasa.gov/kms/audit/metadata-corrections>')
    }))

    const sparqlCall = vi.mocked(sparqlRequest).mock.calls[0][0]
    expect(sparqlCall.body).toContain('gcmd:MetadataCorrectionAuditRecord')
    expect(sparqlCall.body).toContain('gcmd:publishedVersionName "9.1.5"')
    expect(sparqlCall.body).toContain('gcmd:collectionConceptId "C1234567890-LOCAL"')
    expect(sparqlCall.body).toContain('gcmd:action "UPDATED"')
    expect(sparqlCall.body).toContain('gcmd:scheme "sciencekeywords"')
    expect(sparqlCall.body).toContain('gcmd:status "pending"')
    expect(sparqlCall.body).toContain('gcmd:triggerScheme "sciencekeywords"')
    expect(sparqlCall.body).toContain('gcmd:triggerKeywordUuid "2e5a401b-1507-4f57-82b8-36557c13b154"')
    expect(sparqlCall.body).toContain('gcmd:oldKeywordPath "EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS >  >  > "')
    expect(sparqlCall.body).toContain('gcmd:newKeywordPath "Science Keywords > EARTH SCIENCE > ATMOSPHERE > AEROSOLS"')
    expect(sparqlCall.body).toContain('metadata-correction-audit/audit-record-123')
  })

  test('returns without writing when there are no corrections', async () => {
    const result = await persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C1234567890-LOCAL',
      nativeFormat: 'UMM',
      delegateName: 'umm'
    })

    expect(result).toEqual({
      insertedCount: 0,
      publishedVersionName: 'published',
      status: 'pending'
    })

    expect(getVersionMetadata).not.toHaveBeenCalled()
    expect(sparqlRequest).not.toHaveBeenCalled()
  })

  test('throws when required audit fields are missing', async () => {
    await expect(persistMetadataCorrectionAuditLog({
      nativeFormat: 'UMM',
      delegateName: 'umm',
      corrections: [{}]
    })).rejects.toThrow('Missing collectionConceptId for metadata correction audit persistence')

    await expect(persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C1234567890-LOCAL',
      delegateName: 'umm',
      corrections: [{}]
    })).rejects.toThrow('Missing nativeFormat for metadata correction audit persistence')

    await expect(persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C1234567890-LOCAL',
      nativeFormat: 'UMM',
      corrections: [{}]
    })).rejects.toThrow('Missing delegateName for metadata correction audit persistence')
  })

  test('defaults published version, timestamp, and action while omitting optional trigger triples', async () => {
    vi.mocked(getVersionMetadata).mockResolvedValue({
      version: 'published',
      versionName: '',
      versionType: 'published',
      created: '2026-01-01T00:00:00Z',
      lastSynced: null
    })

    await persistMetadataCorrectionAuditLog({
      collectionConceptId: 'C2222222222-LOCAL',
      nativeFormat: 'DIF10',
      delegateName: 'dif10',
      corrections: [
        {
          scheme: 'platforms',
          keywordConceptUuid: 'uuid-optional',
          oldKeywordObject: {
            PathSegments: ['OLD PLATFORM'],
            ShortName: 'OLD PLATFORM'
          },
          newKeywordObject: {
            PathSegments: ['NEW PLATFORM'],
            ShortName: 'NEW PLATFORM'
          }
        }
      ]
    })

    const sparqlCall = vi.mocked(sparqlRequest).mock.calls[0][0]
    expect(sparqlCall.body).toContain('gcmd:publishedVersionName "published"')
    expect(sparqlCall.body).toContain('gcmd:action "UNKNOWN"')
    expect(sparqlCall.body).toContain('gcmd:delegateName "dif10"')
    expect(sparqlCall.body).toContain('gcmd:nativeFormat "DIF10"')
    expect(sparqlCall.body).toContain('gcmd:oldKeywordPath "OLD PLATFORM"')
    expect(sparqlCall.body).toContain('gcmd:newKeywordPath "NEW PLATFORM"')
    expect(sparqlCall.body).toContain('^^xsd:dateTime')
    expect(sparqlCall.body).not.toContain('gcmd:triggerScheme')
    expect(sparqlCall.body).not.toContain('gcmd:triggerKeywordUuid')
  })
})
