import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from '../applyEcho10MetadataCorrections'
import { applyIso19115MetadataCorrections } from '../applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from '../applyIsoSmapMetadataCorrections'
import { applyUmmMetadataCorrections } from '../applyUmmMetadataCorrections'
import { ingestCorrectedMetadataStub } from '../ingestCorrectedMetadataStub'

describe('metadata correction delegate stubs', () => {
  test('returns the expected UMM delegate stub shape', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ShortName: 'TEST'
      }
    })).resolves.toEqual({
      nativeFormat: 'UMM',
      delegateName: 'umm',
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      correctionCount: 0,
      correctedMetadata: {
        ShortName: 'TEST'
      },
      correctionsApplied: [],
      stubbed: true
    })
  })

  test('returns the expected ISO19115 delegate stub shape', async () => {
    await expect(applyIso19115MetadataCorrections({
      collectionConceptId: 'C2',
      providerId: 'PROV',
      nativeId: 'native-2'
    })).resolves.toEqual({
      nativeFormat: 'ISO19115',
      delegateName: 'iso19115',
      collectionConceptId: 'C2',
      providerId: 'PROV',
      nativeId: 'native-2',
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: [],
      stubbed: true
    })
  })

  test('returns the expected ISO_SMAP delegate stub shape', async () => {
    await expect(applyIsoSmapMetadataCorrections({
      collectionConceptId: 'C3',
      providerId: 'PROV',
      nativeId: 'native-3'
    })).resolves.toEqual({
      nativeFormat: 'ISO_SMAP',
      delegateName: 'iso_smap',
      collectionConceptId: 'C3',
      providerId: 'PROV',
      nativeId: 'native-3',
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: [],
      stubbed: true
    })
  })

  test('returns the expected ECHO10 delegate stub shape', async () => {
    await expect(applyEcho10MetadataCorrections({
      collectionConceptId: 'C4',
      providerId: 'PROV',
      nativeId: 'native-4'
    })).resolves.toEqual({
      nativeFormat: 'ECHO10',
      delegateName: 'echo10',
      collectionConceptId: 'C4',
      providerId: 'PROV',
      nativeId: 'native-4',
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: [],
      stubbed: true
    })
  })

  test('returns the expected DIF10 delegate stub shape', async () => {
    await expect(applyDif10MetadataCorrections({
      collectionConceptId: 'C5',
      providerId: 'PROV',
      nativeId: 'native-5'
    })).resolves.toEqual({
      nativeFormat: 'DIF10',
      delegateName: 'dif10',
      collectionConceptId: 'C5',
      providerId: 'PROV',
      nativeId: 'native-5',
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: [],
      stubbed: true
    })
  })

  test('returns the expected ingest stub shape', async () => {
    await expect(ingestCorrectedMetadataStub({
      collectionConceptId: 'C6',
      nativeFormat: 'UMM',
      correctionCount: 3
    })).resolves.toEqual({
      collectionConceptId: 'C6',
      nativeFormat: 'UMM',
      correctionCount: 3,
      ingested: false,
      stubbed: true
    })
  })
})
