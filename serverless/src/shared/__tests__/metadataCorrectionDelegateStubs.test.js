import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from '../applyEcho10MetadataCorrections'
import { applyIso19115MetadataCorrections } from '../applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from '../applyIsoSmapMetadataCorrections'
import { applyUmmcMetadataCorrections } from '../applyUmmcMetadataCorrections'
import { ingestCorrectedMetadataStub } from '../ingestCorrectedMetadataStub'

const LEGACY_AEROSOLS_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'AEROSOLS',
  VariableLevel1: 'LEGACY AEROSOLS',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const AEROSOLS_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'AEROSOLS',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const AQUA_LEGACY_PLATFORM_KEYWORD = {
  Category: 'Platforms',
  Class: 'Space-based Platforms',
  Type: 'Earth Observation Satellites',
  ShortName: 'Aqua Legacy'
}

const AQUA_PLATFORM_KEYWORD = {
  Category: 'Platforms',
  Class: 'Space-based Platforms',
  Type: 'Earth Observation Satellites',
  ShortName: 'Aqua'
}

const HU25A_PLATFORM_KEYWORD = {
  Category: 'Platforms',
  Class: 'Space-based Platforms',
  Type: 'Earth Observation Satellites',
  ShortName: 'HU-25A'
}

describe('metadata correction delegate stubs', () => {
  test('returns the expected UMM delegate stub shape', async () => {
    const result = await applyUmmcMetadataCorrections({
      nativeFormat: 'UMM',
      delegateName: 'umm',
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ShortName: 'TEST'
      }
    })

    // Parse the serialized JSON string back into an object
    const correctedMetadataObject = JSON.parse(result.correctedMetadata)

    expect(result).toMatchObject({
      nativeFormat: 'UMM',
      delegateName: 'umm',
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      correctionCount: 0,
      correctionsApplied: [],
      stubbed: false
    })

    // Assert against the object structure instead of the string format
    expect(correctedMetadataObject).toEqual({
      ShortName: 'TEST'
    })
  })

  test('applies science keyword and platform corrections to UMM metadata', async () => {
    const result = await applyUmmcMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ShortName: 'TEST',
        Platforms: [{ ShortName: 'Aqua Legacy' }],
        ScienceKeywords: [{
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS',
          VariableLevel1: 'LEGACY AEROSOLS'
        }]
      },
      corrections: [
        {
          scheme: 'sciencekeywords',
          ummPath: ['ScienceKeywords', 0],
          oldKeywordObject: LEGACY_AEROSOLS_KEYWORD,
          newKeywordObject: AEROSOLS_KEYWORD
        },
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0],
          oldKeywordObject: AQUA_LEGACY_PLATFORM_KEYWORD,
          newKeywordObject: AQUA_PLATFORM_KEYWORD
        }
      ]
    })

    // 1. Verify the metadata structure by parsing the JSON string
    const correctedMetadata = JSON.parse(result.correctedMetadata)

    expect(correctedMetadata).toMatchObject({
      ShortName: 'TEST',
      Platforms: [{ ShortName: 'Aqua' }],
      ScienceKeywords: [{
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS'
      }]
    })

    // 2. Verify the rest of the response object
    expect(result).toMatchObject({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      correctionCount: 2,
      stubbed: false
    })
  })

  test('removes a project keyword when a delete correction is applied', async () => {
  // 1. Stringify the input payload
    const metadataPayload = {
      ShortName: 'TEST',
      Projects: [{ ShortName: 'Legacy Climate Study' }]
    }

    const result = await applyUmmcMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload, // Pass the stringified JSON
      corrections: [{
        scheme: 'projects',
        action: 'delete',
        ummPath: ['Projects', 0],
        oldKeywordObject: {
          ShortName: 'Legacy Climate Study'
        },
        newKeywordObject: {}
      }]
    })

    // 2. Parse the result to verify
    const correctedMetadata = JSON.parse(result.correctedMetadata)

    // Projects should be removed by the editor's afterDelete hook
    expect(correctedMetadata).not.toHaveProperty('Projects')
    expect(correctedMetadata.ShortName).toBe('TEST')

    // 3. Verify the rest of the response
    expect(result).toMatchObject({
      collectionConceptId: 'C1',
      correctionCount: 1,
      stubbed: false // Correct: the engine performed a real transformation
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

  test('returns the expected DIF10 no-payload shape', async () => {
    await expect(applyDif10MetadataCorrections({
      collectionConceptId: 'C5',
      providerId: 'PROV',
      nativeId: 'native-5'
    })).resolves.toEqual({
      correctionCount: 0,
      stubbed: true
    })
  })

  test('returns the expected DIF10 no-payload shape even when corrections are provided', async () => {
    await expect(applyDif10MetadataCorrections({
      collectionConceptId: 'C5',
      providerId: 'PROV',
      nativeId: 'native-5',
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          keywordConceptUuid: 'uuid-5',
          oldKeywordObject: HU25A_PLATFORM_KEYWORD,
          newKeywordObject: HU25A_PLATFORM_KEYWORD,
          oldLongName: 'Dassault HU-25A Guardian Legacy',
          newLongName: 'Dassault HU-25A Guardian'
        }
      ]
    })).resolves.toEqual({
      correctionCount: 0,
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
      providerId: undefined,
      nativeId: undefined,
      nativeFormat: 'UMM',
      correctionCount: 3,
      ingested: false,
      updated: false,
      stubbed: true
    })
  })
})
