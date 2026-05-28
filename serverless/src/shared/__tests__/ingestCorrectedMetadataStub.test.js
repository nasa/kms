import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { ingestCorrectedMetadataStub } from '../ingestCorrectedMetadataStub'
import { persistMockCmrCollectionMetadata } from '../persistMockCmrCollectionMetadata'

vi.mock('../persistMockCmrCollectionMetadata', () => ({
  persistMockCmrCollectionMetadata: vi.fn()
}))

describe('ingestCorrectedMetadataStub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns an applied result when writeback succeeds', async () => {
    vi.mocked(persistMockCmrCollectionMetadata).mockResolvedValue({
      updated: true,
      enabled: true,
      revisionId: 4
    })

    await expect(ingestCorrectedMetadataStub({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      nativeFormat: 'UMM',
      correctionCount: 2,
      correctedMetadata: {
        ShortName: 'TEST'
      }
    })).resolves.toEqual({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      nativeFormat: 'UMM',
      correctionCount: 2,
      ingested: true,
      updated: true,
      revisionId: 4,
      enabled: true,
      stubbed: true
    })
  })

  test('returns a pending result with a writeback error message when writeback fails', async () => {
    vi.mocked(persistMockCmrCollectionMetadata).mockRejectedValue(new Error('writeback failed'))

    await expect(ingestCorrectedMetadataStub({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      nativeFormat: 'UMM',
      correctionCount: 2,
      correctedMetadata: {
        ShortName: 'TEST'
      }
    })).resolves.toEqual({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      nativeFormat: 'UMM',
      correctionCount: 2,
      ingested: false,
      updated: false,
      writebackErrorMessage: 'writeback failed',
      stubbed: true
    })
  })
})
