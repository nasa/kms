import {
  describe,
  expect,
  test
} from 'vitest'

import { applyUmmMetadataCorrections } from '../applyUmmMetadataCorrections'

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
          newKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua'
        }
      ]
    })).resolves.toMatchObject({
      correctionCount: 0,
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
          newKeywordPath: 'Science Keywords > EARTH SCIENCE > ATMOSPHERE'
        },
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0, 'ShortName'],
          newKeywordPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua'
        },
        {
          scheme: 'platforms',
          ummPath: ['Platforms', 0],
          newKeywordPath: ''
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
          oldKeywordPath: 'EARTH SCIENCE > CRYOSPHERE >  > LEGACY SNOW/ICE >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > '
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
          oldKeywordPath: 'EARTH SCIENCE > CRYOSPHERE >  > LEGACY SNOW/ICE >  >  > ',
          newKeywordPath: 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > '
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
