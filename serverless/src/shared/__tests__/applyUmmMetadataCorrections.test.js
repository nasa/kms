import {
  describe,
  expect,
  test
} from 'vitest'

import { applyUmmMetadataCorrections } from '../applyUmmMetadataCorrections'

const AQUA_PLATFORM_KEYWORD = {
  Category: 'Platforms',
  Class: 'Space-based Platforms',
  Type: 'Earth Observation Satellites',
  ShortName: 'Aqua'
}

const EARTH_SCIENCE_ATMOSPHERE_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: '',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const CRYOSPHERE_LEGACY_SNOW_ICE_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'CRYOSPHERE',
  Term: '',
  VariableLevel1: 'LEGACY SNOW/ICE',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const CRYOSPHERE_SNOW_ICE_KEYWORD = {
  Category: 'EARTH SCIENCE',
  Topic: 'CRYOSPHERE',
  Term: '',
  VariableLevel1: 'SNOW/ICE',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const NORTHGRIPPIAN_KEYWORD = {
  Eon: 'PHANEROZOIC',
  Era: 'CENOZOIC',
  Period: 'QUATERNARY',
  Epoch: 'HOLOCENE',
  Age: 'NORTHGRIPPIAN',
  SubAge: ''
}

const MEGHALAYAN_KEYWORD = {
  Eon: 'PHANEROZOIC',
  Era: 'CENOZOIC',
  Period: 'QUATERNARY',
  Epoch: 'HOLOCENE',
  Age: 'MEGHALAYAN',
  SubAge: ''
}

describe('applyUmmMetadataCorrections edge cases', () => {
  test('ignores replace corrections when the target keyword cannot be found', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        Platforms: []
      },
      corrections: [
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0],
          newKeywordObject: AQUA_PLATFORM_KEYWORD
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 0,
      correctionsApplied: []
    })
  })

  test('gracefully ignores replace corrections with missing paths and undefined schemes', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        Platforms: [
          {
            ShortName: 'Legacy Aqua'
          }
        ]
      },
      corrections: [
        {
          newKeywordObject: {
            ShortName: 'Aqua'
          }
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 0,
      correctionsApplied: []
    })
  })

  test('returns a stubbed result when metadata payload is missing', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      corrections: []
    })).resolves.toMatchObject({
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: []
    })
  })

  test('ignores malformed replace corrections for science keywords and short-name schemes', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE'
          }
        ],
        Platforms: [
          {
            ShortName: 'Legacy Aqua'
          }
        ]
      },
      corrections: [
        {
          scheme: 'sciencekeywords',
          ummPath: ['ScienceKeywords', 0, 'Category'],
          newKeywordObject: EARTH_SCIENCE_ATMOSPHERE_KEYWORD
        },
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0, 'ShortName'],
          newKeywordObject: AQUA_PLATFORM_KEYWORD
        },
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0],
          newKeywordObject: {}
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 0,
      correctionsApplied: []
    })
  })

  test('ignores delete corrections when the path is missing', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        Projects: [
          {
            ShortName: 'Legacy Project'
          }
        ]
      },
      corrections: [
        {
          action: 'delete',
          scheme: 'projects'
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 0,
      correctionsApplied: [],
      correctedMetadata: {
        Projects: [
          {
            ShortName: 'Legacy Project'
          }
        ]
      }
    })
  })

  test('ignores delete corrections when the array index is out of bounds', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        Projects: [
          {
            ShortName: 'Legacy Project'
          }
        ]
      },
      corrections: [
        {
          action: 'delete',
          scheme: 'projects',
          ummPath: ['Projects', 3]
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 0,
      correctionsApplied: []
    })
  })

  test('preserves interior science keyword slots when rewriting UMM fields', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE',
            Topic: 'CRYOSPHERE',
            VariableLevel1: 'LEGACY SNOW/ICE'
          }
        ]
      },
      corrections: [
        {
          scheme: 'sciencekeywords',
          ummPath: ['ScienceKeywords', 0],
          oldKeywordObject: CRYOSPHERE_LEGACY_SNOW_ICE_KEYWORD,
          newKeywordObject: CRYOSPHERE_SNOW_ICE_KEYWORD
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 1,
      correctedMetadata: {
        ScienceKeywords: [
          {
            Category: 'EARTH SCIENCE',
            Topic: 'CRYOSPHERE',
            VariableLevel1: 'SNOW/ICE'
          }
        ]
      },
      correctionsApplied: [
        {
          scheme: 'sciencekeywords',
          ummPath: ['ScienceKeywords', 0],
          oldKeywordObject: CRYOSPHERE_LEGACY_SNOW_ICE_KEYWORD,
          newKeywordObject: CRYOSPHERE_SNOW_ICE_KEYWORD
        }
      ]
    })
  })

  test('maps canonical chronounit slots back into UMM field names', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        PaleoTemporalCoverages: [
          {
            ChronostratigraphicUnits: [
              {
                Eon: 'PHANEROZOIC',
                Era: 'CENOZOIC',
                Period: 'QUATERNARY',
                Epoch: 'HOLOCENE',
                Stage: 'NORTHGRIPPIAN'
              }
            ]
          }
        ]
      },
      corrections: [
        {
          scheme: 'chronounits',
          ummPath: ['PaleoTemporalCoverages', 0, 'ChronostratigraphicUnits', 0],
          oldKeywordObject: NORTHGRIPPIAN_KEYWORD,
          newKeywordObject: MEGHALAYAN_KEYWORD
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 1,
      correctedMetadata: {
        PaleoTemporalCoverages: [
          {
            ChronostratigraphicUnits: [
              {
                Eon: 'PHANEROZOIC',
                Era: 'CENOZOIC',
                Period: 'QUATERNARY',
                Epoch: 'HOLOCENE',
                Stage: 'MEGHALAYAN'
              }
            ]
          }
        ]
      },
      correctionsApplied: [
        {
          scheme: 'chronounits',
          ummPath: ['PaleoTemporalCoverages', 0, 'ChronostratigraphicUnits', 0],
          oldKeywordObject: NORTHGRIPPIAN_KEYWORD,
          newKeywordObject: MEGHALAYAN_KEYWORD
        }
      ]
    })
  })

  test('supports object-property deletes and ignores invalid delete paths', async () => {
    await expect(applyUmmMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: {
        ProcessingLevel: {
          Id: 'L1'
        },
        Projects: [
          {
            ShortName: 'Legacy Climate Study'
          }
        ]
      },
      corrections: [
        {
          scheme: 'productlevelid',
          action: 'delete',
          ummPath: ['ProcessingLevel', 'Id']
        },
        {
          scheme: 'productlevelid',
          action: 'delete',
          ummPath: ['ProcessingLevel', 'MissingField']
        },
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: []
        },
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['Projects', 5]
        },
        {
          scheme: 'projects',
          action: 'delete',
          ummPath: ['ProcessingLevel', 0]
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 1,
      correctedMetadata: {
        ProcessingLevel: {},
        Projects: [
          {
            ShortName: 'Legacy Climate Study'
          }
        ]
      },
      correctionsApplied: [
        {
          scheme: 'productlevelid',
          action: 'delete',
          ummPath: ['ProcessingLevel', 'Id']
        }
      ]
    })
  })
})
