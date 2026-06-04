import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { ingestCorrectedMetadataStub } from '../ingestCorrectedMetadataStub'
import { writeCorrectedMetadataToCmr } from '../writeCorrectedMetadataToCmr'

vi.mock('../ingestCorrectedMetadataStub', () => ({
  ingestCorrectedMetadataStub: vi.fn()
}))

describe('when writing corrected metadata to cmr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ingestCorrectedMetadataStub).mockImplementation(async ({
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctionCount
    }) => ({
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctionCount,
      ingested: false,
      updated: false,
      stubbed: true
    }))
  })

  test('should return a stub summary for corrected metadata ready for downstream persistence', async () => {
    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 2,
      correctionsApplied: [{ scheme: 'sciencekeywords' }, { scheme: 'platforms' }],
      correctedMetadata: '<DIF><Entry_ID/></DIF>',
      source: 'metadataCorrectionService'
    })

    expect(result).toEqual({
      stubbed: true,
      targetComponent: 'cmr-writeback',
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 2,
      correctionsAppliedCount: 2,
      correctedMetadataBytes: Buffer.byteLength('<DIF><Entry_ID/></DIF>', 'utf8'),
      source: 'metadataCorrectionService',
      ingestResult: {
        collectionConceptId: 'C0000000000-KMS',
        providerId: 'KMS',
        nativeId: 'native-1',
        nativeFormat: 'DIF10',
        correctionCount: 2,
        ingested: false,
        updated: false,
        stubbed: true
      }
    })

    expect(ingestCorrectedMetadataStub).toHaveBeenCalledWith({
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 2,
      correctedMetadata: '<DIF><Entry_ID/></DIF>'
    })
  })

  test('should default missing values when the write stub receives partial input', async () => {
    const result = await writeCorrectedMetadataToCmr()

    expect(result).toEqual({
      stubbed: true,
      targetComponent: 'cmr-writeback',
      collectionConceptId: null,
      providerId: null,
      nativeId: null,
      nativeFormat: null,
      correctionCount: 0,
      correctionsAppliedCount: 0,
      correctedMetadataBytes: 0,
      source: null,
      ingestResult: {
        collectionConceptId: null,
        providerId: null,
        nativeId: null,
        nativeFormat: null,
        correctionCount: 0,
        ingested: false,
        updated: false,
        stubbed: true
      }
    })
  })

  test('should treat non-array applied corrections as zero applied corrections', async () => {
    const result = await writeCorrectedMetadataToCmr({
      correctionsApplied: {
        scheme: 'sciencekeywords'
      }
    })

    expect(result.correctionsAppliedCount).toBe(0)
  })

  test('should serialize object corrected metadata before reporting payload bytes', async () => {
    vi.mocked(ingestCorrectedMetadataStub).mockResolvedValue({
      collectionConceptId: 'C1234567890-LOCAL',
      providerId: 'LOCAL',
      nativeId: 'native-umm-1',
      nativeFormat: 'UMM',
      correctionCount: 1,
      ingested: true,
      updated: true,
      revisionId: 2,
      enabled: true,
      stubbed: true
    })

    const correctedMetadata = {
      ShortName: 'UPDATED'
    }
    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C1234567890-LOCAL',
      providerId: 'LOCAL',
      nativeId: 'native-umm-1',
      nativeFormat: 'UMM',
      correctionCount: 1,
      correctedMetadata
    })

    expect(result.correctedMetadataBytes).toBe(
      Buffer.byteLength(JSON.stringify(correctedMetadata), 'utf8')
    )

    expect(result.ingestResult).toEqual({
      collectionConceptId: 'C1234567890-LOCAL',
      providerId: 'LOCAL',
      nativeId: 'native-umm-1',
      nativeFormat: 'UMM',
      correctionCount: 1,
      ingested: true,
      updated: true,
      revisionId: 2,
      enabled: true,
      stubbed: true
    })
  })

  test('should treat null corrected metadata as an empty serialized payload for byte counting', async () => {
    const result = await writeCorrectedMetadataToCmr({
      correctedMetadata: null
    })

    expect(result.correctedMetadataBytes).toBe(
      Buffer.byteLength(JSON.stringify(''), 'utf8')
    )

    expect(ingestCorrectedMetadataStub).toHaveBeenCalledWith({
      collectionConceptId: null,
      providerId: null,
      nativeId: null,
      nativeFormat: null,
      correctionCount: 0,
      correctedMetadata: null
    })
  })
})
