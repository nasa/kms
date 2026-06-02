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
    })).resolves.toMatchObject({
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

  test('applies science keyword and platform corrections to UMM metadata', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ShortName: 'TEST',
        Platforms: [
          {
            ShortName: 'Aqua Legacy'
          }
        ],
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: 'LEGACY AEROSOLS'
          }
        ]
      },
      corrections: [
        {
          scheme: 'sciencekeywords',
          ummPath: ['ScienceKeywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS',
          newKeywordPath: 'Science Keywords > EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        },
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0],
          oldKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua Legacy',
          newKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua'
        }
      ]
    })).resolves.toMatchObject({
      nativeFormat: 'UMM',
      delegateName: 'umm',
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      correctionCount: 2,
      correctedMetadata: {
        ShortName: 'TEST',
        Platforms: [
          {
            ShortName: 'Aqua'
          }
        ],
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS'
          }
        ]
      },
      correctionsApplied: [
        {
          scheme: 'sciencekeywords',
          ummPath: ['ScienceKeywords', 0],
          oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS',
          newKeywordPath: 'Science Keywords > EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        },
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0],
          oldKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua Legacy',
          newKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua'
        }
      ],
      stubbed: true
    })
  })

  test('removes a project keyword when a delete correction is applied', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ShortName: 'TEST',
        Projects: [
          {
            ShortName: 'Legacy Climate Study'
          }
        ]
      },
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Projects', 0],
          oldKeywordPath: 'Projects > Legacy Climate Study',
          newKeywordPath: ''
        }
      ]
    })).resolves.toMatchObject({
      nativeFormat: 'UMM',
      delegateName: 'umm',
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      correctionCount: 1,
      correctedMetadata: {
        ShortName: 'TEST',
        Projects: []
      },
      correctionsApplied: [
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Projects', 0],
          oldKeywordPath: 'Projects > Legacy Climate Study',
          newKeywordPath: ''
        }
      ],
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
          oldKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > HU-25A',
          newKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > HU-25A',
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
