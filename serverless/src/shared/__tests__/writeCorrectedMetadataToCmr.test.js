import {
  describe,
  expect,
  test
} from 'vitest'

import { writeCorrectedMetadataToCmr } from '../writeCorrectedMetadataToCmr'

describe('when writing corrected metadata to cmr', () => {
  test('should return a stub summary for corrected metadata ready for downstream persistence', async () => {
    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
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
      nativeFormat: 'DIF10',
      correctionCount: 2,
      correctionsAppliedCount: 2,
      correctedMetadataBytes: Buffer.byteLength('<DIF><Entry_ID/></DIF>', 'utf8'),
      source: 'metadataCorrectionService'
    })
  })

  test('should default missing values when the write stub receives partial input', async () => {
    const result = await writeCorrectedMetadataToCmr()

    expect(result).toEqual({
      stubbed: true,
      targetComponent: 'cmr-writeback',
      collectionConceptId: null,
      nativeFormat: null,
      correctionCount: 0,
      correctionsAppliedCount: 0,
      correctedMetadataBytes: 0,
      source: null
    })
  })

  test('should coerce unsupported payload shapes into safe telemetry values', async () => {
    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000001-KMS',
      nativeFormat: 'DIF10',
      correctedMetadata: { xml: true },
      correctionCount: '',
      correctionsApplied: null,
      source: 'metadataCorrectionService'
    })

    expect(result).toEqual({
      stubbed: true,
      targetComponent: 'cmr-writeback',
      collectionConceptId: 'C0000000001-KMS',
      nativeFormat: 'DIF10',
      correctionCount: 0,
      correctionsAppliedCount: 0,
      correctedMetadataBytes: 0,
      source: 'metadataCorrectionService'
    })
  })
})
