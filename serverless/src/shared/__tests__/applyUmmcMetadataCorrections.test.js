import { readFileSync } from 'fs'
import { join } from 'path'

import {
  describe,
  expect,
  test
} from 'vitest'

import {
  applyUmmcMetadataCorrections as applyUmmcMetadataCorrectionsRaw
} from '../applyUmmcMetadataCorrections'

const applyUmmcMetadataCorrections = (params = {}) => applyUmmcMetadataCorrectionsRaw(params)

const mockUmmcSimple = {
  ShortName: 'TEST_COLLECTION',
  Version: '001',
  EntryTitle: 'Simple Test Collection',
  ScienceKeywords: [
    {
      Category: 'EARTH SCIENCE',
      Topic: 'ATMOSPHERE',
      Term: 'AEROSOLS'
    }
  ],
  Platforms: [
    {
      Type: 'Earth Observation Satellites',
      ShortName: 'SPOT-4',
      LongName: 'Systeme Observation de la Terre-4',
      Instruments: [
        {
          ShortName: 'VEGETATION-1',
          LongName: 'VEGETATION INSTRUMENT 1 (SPOT 4)'
        }
      ]
    }
  ],
  LocationKeywords: [
    {
      Category: 'GEOGRAPHIC REGION',
      Type: 'ARCTIC'
    }
  ]
}

const mockUmmcComplex = {
  ShortName: 'ECSE-1916',
  Version: '002',
  EntryTitle: 'ECSE-1916 - UMM 1.18.5',
  CollectionProgress: 'ACTIVE',
  ScienceKeywords: [
    {
      Category: 'EARTH SCIENCE',
      Topic: 'LAND SURFACE',
      Term: 'SURFACE THERMAL PROPERTIES',
      VariableLevel1: 'LAND SURFACE TEMPERATURE'
    },
    {
      Category: 'EARTH SCIENCE',
      Topic: 'LAND SURFACE',
      Term: 'LAND USE/LAND COVER',
      VariableLevel1: 'LAND USE/LAND COVER CLASSIFICATION',
      VariableLevel2: 'VEGETATION INDEX',
      VariableLevel3: 'NORMALIZED DIFFERENCE VEGETATION INDEX (NDVI)'
    }
  ],
  Platforms: [
    {
      Type: 'Space Stations/Crewed Spacecraft',
      ShortName: 'ISS',
      LongName: 'International Space Station',
      Instruments: [
        {
          ShortName: 'ECOSTRESS',
          LongName: 'ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station',
          ComposedOf: [
            {
              ShortName: 'PHyTIR',
              LongName: 'Prototype HyspIRI Thermal Infrared Radiometer'
            }
          ]
        }
      ]
    }
  ],
  LocationKeywords: [
    {
      Category: 'GEOGRAPHIC REGION',
      Type: 'GLOBAL LAND'
    }
  ],
  Projects: [
    {
      ShortName: 'ESIP',
      LongName: 'Earth Science Information Partners Program'
    },
    {
      ShortName: 'ICEBRIDGE',
      LongName: 'IceBridge Mission'
    }
  ],
  DataCenters: [
    {
      ShortName: 'AcmeData',
      LongName: 'Acme Data Center',
      Roles: ['ARCHIVER']
    },
    {
      ShortName: 'NASA/GSFC',
      LongName: 'NASA Goddard Space Flight Center',
      Roles: ['DISTRIBUTOR']
    }
  ],
  RelatedUrls: [
    {
      URLContentType: 'PublicationURL',
      Type: 'VIEW RELATED INFORMATION',
      Subtype: 'ANOMALIES',
      URL: 'https://git.earthdata.nasa.gov/projects/EMFD/repos/unified-metadata-model/browse/collection'
    },
    {
      URLContentType: 'DistributionURL',
      Type: 'GET DATA',
      Subtype: 'DIRECT DOWNLOAD',
      URL: 'https://example.com/data'
    }
  ],
  DirectoryNames: [
    {
      ShortName: 'AMD/NZ',
      LongName: 'Antarctic Master Directory/New Zealand'
    },
    {
      ShortName: 'CEOS'
    }
  ],
  ISOTopicCategories: [
    'GEOSCIENTIFIC INFORMATION',
    'CLIMATOLOGY/METEOROLOGY/ATMOSPHERE'
  ],
  ProcessingLevel: {
    Id: '2',
    ProcessingLevelDescription: 'Level 2 data products'
  },
  PaleoTemporalCoverages: [
    {
      ChronostratigraphicUnits: [
        {
          Eon: 'PHANEROZOIC',
          Era: 'CENOZOIC',
          Period: 'QUATERNARY',
          Epoch: 'HOLOCENE'
        }
      ]
    }
  ],
  Abstract: 'Test abstract for metadata corrections',
  Purpose: 'Science Research'
}

describe('when applying UMM-C metadata corrections', () => {
  test('should return early if metadataPayload is missing', async () => {
    const result = await applyUmmcMetadataCorrections({ metadataPayload: null })
    expect(result.correctionCount).toBe(0)
    expect(result.stubbed).toBe(true)
  })

  test('should parse metadataPayload when it is provided as a JSON string', async () => {
    const jsonStringPayload = JSON.stringify({
      ShortName: 'STRING_TEST_COLLECTION',
      Version: '001',
      EntryTitle: 'JSON String Test Collection'
    })

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: jsonStringPayload,
      corrections: []
    })

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ShortName).toBe('STRING_TEST_COLLECTION')
    expect(parsed.EntryTitle).toBe('JSON String Test Collection')
  })

  test('should apply multiple corrections from different schemes sequentially', async () => {
    const corrections = [
      {
        scheme: 'sciencekeywords',
        action: 'replace',
        oldKeywordObject: {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS',
          VariableLevel1: '',
          VariableLevel2: '',
          VariableLevel3: '',
          DetailedVariable: ''
        },
        newKeywordObject: {
          Category: 'EARTH SCIENCE',
          Topic: 'OCEANS',
          Term: 'MARINE SEDIMENTS',
          VariableLevel1: '',
          VariableLevel2: '',
          VariableLevel3: '',
          DetailedVariable: ''
        }
      },
      {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: {
          Type: 'Earth Observation Satellites',
          ShortName: 'SPOT-4'
        },
        newKeywordObject: {
          Type: 'Earth Observation Satellites',
          ShortName: 'SPOT-5'
        },
        newLongName: 'Systeme Observation de la Terre-5'
      }
    ]

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections
    })

    expect(result.correctionCount).toBe(2)
    expect(result.correctionsApplied).toHaveLength(2)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].Topic).toBe('OCEANS')
    expect(parsed.ScienceKeywords[0].Term).toBe('MARINE SEDIMENTS')
    expect(parsed.Platforms[0].ShortName).toBe('SPOT-5')
    expect(parsed.Platforms[0].LongName).toBe('Systeme Observation de la Terre-5')
  })

  test('should handle unknown schemes gracefully by ignoring them', async () => {
    const corrections = [
      {
        scheme: 'invalid_scheme',
        action: 'replace',
        newKeywordObject: {
          Value: 'Should Not Apply'
        }
      }
    ]

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].Term).toBe('AEROSOLS')
  })

  test('should ignore corrections when the scheme is missing', async () => {
    const corrections = [
      {
        action: 'replace',
        newKeywordObject: {
          Value: 'Should Not Apply'
        }
      }
    ]

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should handle delete actions for locations', async () => {
    const corrections = [
      {
        scheme: 'locations',
        action: 'delete',
        oldKeywordObject: {
          Category: 'GEOGRAPHIC REGION',
          Type: 'ARCTIC',
          Subregion1: '',
          Subregion2: '',
          Subregion3: '',
          DetailedLocation: ''
        }
      }
    ]

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.LocationKeywords).toBeUndefined()
  })

  test('should verify JSON formatting and structure', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections: []
    })

    expect(() => JSON.parse(result.correctedMetadata)).not.toThrow()

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ShortName).toBe('TEST_COLLECTION')
  })
})

describe('when correcting a UMM-C record', () => {
  test('should return a corrected UMM-C', async () => {
    const mockUmmcJson = JSON.parse(readFileSync(
      join(__dirname, '../__mocks__/ummc.json'),
      'utf-8'
    ))

    const corrections = [
      {
        scheme: 'sciencekeywords',
        action: 'replace',
        oldKeywordObject: {
          Category: 'EARTH SCIENCE',
          Topic: 'LAND SURFACE',
          Term: 'SURFACE THERMAL PROPERTIES',
          VariableLevel1: 'LAND SURFACE TEMPERATURE',
          VariableLevel2: '',
          VariableLevel3: '',
          DetailedVariable: ''
        },
        newKeywordObject: {
          Category: 'EARTH SCIENCE',
          Topic: 'LAND SURFACE',
          Term: 'SURFACE THERMAL PROPERTIES',
          VariableLevel1: 'SURFACE TEMPERATURE',
          VariableLevel2: '',
          VariableLevel3: '',
          DetailedVariable: ''
        }
      },
      {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: {
          Type: 'Space Stations/Crewed Spacecraft',
          ShortName: 'ISS'
        },
        newKeywordObject: {
          Type: 'Space Stations/Crewed Spacecraft',
          ShortName: 'ISS-UPDATED'
        },
        newLongName: 'International Space Station Updated'
      },
      {
        scheme: 'instruments',
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'ECOSTRESS'
        },
        newKeywordObject: {
          ShortName: 'ECOSTRESS-2'
        },
        newLongName: 'ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station v2'
      },
      {
        scheme: 'locations',
        action: 'replace',
        oldKeywordObject: {
          Category: 'GEOGRAPHIC REGION',
          Type: 'GLOBAL LAND',
          Subregion1: '',
          Subregion2: '',
          Subregion3: '',
          DetailedLocation: ''
        },
        newKeywordObject: {
          Category: 'GEOGRAPHIC REGION',
          Type: 'GLOBAL',
          Subregion1: '',
          Subregion2: '',
          Subregion3: '',
          DetailedLocation: ''
        }
      },
      {
        scheme: 'projects',
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'ESIP'
        },
        newKeywordObject: {
          ShortName: 'ESIP-UPDATED'
        },
        newLongName: 'Earth Science Information Partners Program Updated'
      },
      {
        scheme: 'providers',
        action: 'replace',
        oldKeywordObject: {
          ShortName: 'AcmeData'
        },
        newKeywordObject: {
          ShortName: 'AcmeData-2'
        },
        newLongName: 'Acme Data Center v2'
      },
      {
        scheme: 'rucontenttype',
        action: 'replace',
        oldKeywordObject: {
          URLContentType: 'PublicationURL',
          Type: 'VIEW RELATED INFORMATION',
          Subtype: 'ANOMALIES'
        },
        newKeywordObject: {
          URLContentType: 'PublicationURL',
          Type: 'VIEW RELATED INFORMATION',
          Subtype: 'USER GUIDE'
        }
      },
      {
        scheme: 'idnnode',
        action: 'delete',
        oldKeywordObject: {
          ShortName: 'CEOS'
        }
      },
      {
        scheme: 'isotopiccategory',
        action: 'replace',
        oldKeywordObject: {
          Value: 'GEOSCIENTIFIC INFORMATION'
        },
        newKeywordObject: {
          Value: 'OCEANS'
        }
      },
      {
        scheme: 'productlevelid',
        action: 'replace',
        oldKeywordObject: {
          Value: '2'
        },
        newKeywordObject: {
          Value: '3'
        }
      }
    ]

    const result = await applyUmmcMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockUmmcJson,
      corrections
    })

    expect(result.correctionCount).toBe(10)
    expect(result.stubbed).toBe(false)

    const appliedSchemes = result.correctionsApplied.map((c) => c.scheme)
    expect(appliedSchemes).toEqual([
      'sciencekeywords',
      'platforms',
      'instruments',
      'locations',
      'projects',
      'providers',
      'rucontenttype',
      'idnnode',
      'isotopiccategory',
      'productlevelid'
    ])

    const parsed = JSON.parse(result.correctedMetadata)

    // ScienceKeywords verification
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('SURFACE TEMPERATURE')

    // Platforms verification
    expect(parsed.Platforms[0].ShortName).toBe('ISS-UPDATED')
    expect(parsed.Platforms[0].LongName).toBe('International Space Station Updated')

    // Instruments verification
    expect(parsed.Platforms[0].Instruments[0].ShortName).toBe('ECOSTRESS-2')
    expect(parsed.Platforms[0].Instruments[0].LongName).toBe('ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station v2')

    // Locations verification
    expect(parsed.LocationKeywords[0].Type).toBe('GLOBAL')

    // Projects verification
    const esipProject = parsed.Projects.find((p) => p.ShortName === 'ESIP-UPDATED')
    expect(esipProject).toBeDefined()
    expect(esipProject.LongName).toBe('Earth Science Information Partners Program Updated')

    // Providers verification
    const acmeProvider = parsed.DataCenters.find((dc) => dc.ShortName === 'AcmeData-2')
    expect(acmeProvider).toBeDefined()
    expect(acmeProvider.LongName).toBe('Acme Data Center v2')

    // RUContentType verification
    expect(parsed.RelatedUrls[0].Subtype).toBe('USER GUIDE')

    // IDN Node verification
    expect(parsed.DirectoryNames).toHaveLength(1)
    expect(parsed.DirectoryNames.find((d) => d.ShortName === 'CEOS')).toBeUndefined()

    // ISO Topic Category verification
    expect(parsed.ISOTopicCategories).toContain('OCEANS')
    expect(parsed.ISOTopicCategories).not.toContain('GEOSCIENTIFIC INFORMATION')

    // ProcessingLevel verification
    expect(parsed.ProcessingLevel.Id).toBe('3')
  })
})

describe('when verifying UMM-C corrections do not remove unrelated metadata', () => {
  test('should preserve unrelated metadata while applying broad updates and deletes across supported fields', async () => {
    const result = await applyUmmcMetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockUmmcComplex,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'SURFACE THERMAL PROPERTIES',
            VariableLevel1: 'LAND SURFACE TEMPERATURE',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'OCEANS',
            Term: 'MARINE SEDIMENTS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        },
        {
          scheme: 'locations',
          action: 'delete',
          oldKeywordObject: {
            Category: 'GEOGRAPHIC REGION',
            Type: 'GLOBAL LAND',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        },
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ISS'
          },
          newKeywordObject: {
            ShortName: 'ISS-UPDATED'
          },
          newLongName: 'International Space Station Updated'
        },
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ESIP'
          },
          newKeywordObject: {
            ShortName: 'ESIP-UPDATED'
          },
          newLongName: 'Earth Science Information Partners Program Updated'
        },
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'AcmeData'
          },
          newKeywordObject: {
            ShortName: 'AcmeData-Updated'
          },
          newLongName: 'Acme Data Center Updated'
        },
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'PublicationURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'ANOMALIES'
          },
          newKeywordObject: {
            URLContentType: 'PublicationURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'USER GUIDE'
          }
        },
        {
          scheme: 'idnnode',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'CEOS'
          }
        },
        {
          scheme: 'isotopiccategory',
          action: 'replace',
          oldKeywordObject: {
            Value: 'GEOSCIENTIFIC INFORMATION'
          },
          newKeywordObject: {
            Value: 'OCEANS'
          }
        },
        {
          scheme: 'productlevelid',
          action: 'replace',
          oldKeywordObject: {
            Value: '2'
          },
          newKeywordObject: {
            Value: '3'
          }
        }
      ]
    })

    const parsed = JSON.parse(result.correctedMetadata)
    const original = mockUmmcComplex

    expect(result.correctionCount).toBe(9)

    // Verify changes applied
    expect(parsed.ScienceKeywords[0].Topic).toBe('OCEANS')
    expect(parsed.ScienceKeywords[0].Term).toBe('MARINE SEDIMENTS')
    expect(parsed.LocationKeywords).toBeUndefined()
    expect(parsed.Platforms[0].ShortName).toBe('ISS-UPDATED')
    expect(parsed.Projects.find((p) => p.ShortName === 'ESIP-UPDATED')).toBeDefined()
    expect(parsed.DataCenters.find((dc) => dc.ShortName === 'AcmeData-Updated')).toBeDefined()
    expect(parsed.RelatedUrls[0].Subtype).toBe('USER GUIDE')
    expect(parsed.DirectoryNames.find((d) => d.ShortName === 'CEOS')).toBeUndefined()
    expect(parsed.ISOTopicCategories).toContain('OCEANS')
    expect(parsed.ProcessingLevel.Id).toBe('3')

    // Verify preserved fields
    expect(parsed.Abstract).toBe(original.Abstract)
    expect(parsed.Purpose).toBe(original.Purpose)
    expect(parsed.CollectionProgress).toBe(original.CollectionProgress)
    expect(parsed.EntryTitle).toBe(original.EntryTitle)
    expect(parsed.ShortName).toBe(original.ShortName)
    expect(parsed.Version).toBe(original.Version)

    // Verify second science keyword untouched
    expect(parsed.ScienceKeywords[1].Topic).toBe('LAND SURFACE')
    expect(parsed.ScienceKeywords[1].Term).toBe('LAND USE/LAND COVER')

    // Verify second project untouched
    expect(parsed.Projects.find((p) => p.ShortName === 'ICEBRIDGE')).toBeDefined()

    // Verify second data center untouched
    expect(parsed.DataCenters.find((dc) => dc.ShortName === 'NASA/GSFC')).toBeDefined()

    // Verify remaining directory name
    expect(parsed.DirectoryNames.find((d) => d.ShortName === 'AMD/NZ')).toBeDefined()
  })
})

describe('when applying chronounits UMM-C corrections', () => {
  const mockUmmcWithChronounits = {
    ShortName: 'CHRONO_TEST',
    Version: '001',
    PaleoTemporalCoverages: [
      {
        ChronostratigraphicUnits: [
          {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'QUATERNARY',
            Epoch: 'HOLOCENE'
          },
          {
            Eon: 'PHANEROZOIC',
            Era: 'MESOZOIC',
            Period: 'CRETACEOUS'
          }
        ]
      }
    ]
  }

  test('should apply chronostratigraphic unit correction', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'QUATERNARY',
            Epoch: 'HOLOCENE',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'QUATERNARY',
            Epoch: 'PLEISTOCENE',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[0].Epoch).toBe('PLEISTOCENE')
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[0].Era).toBe('CENOZOIC')
  })

  test('should update entire chronostratigraphic hierarchy', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'MESOZOIC',
            Period: 'CRETACEOUS',
            Epoch: '',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'PALEOZOIC',
            Period: 'PERMIAN',
            Epoch: 'LOPINGIAN',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[1].Era).toBe('PALEOZOIC')
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[1].Period).toBe('PERMIAN')
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[1].Epoch).toBe('LOPINGIAN')
  })

  test('should add stage and detailed classification levels', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'QUATERNARY',
            Epoch: 'HOLOCENE',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'QUATERNARY',
            Epoch: 'HOLOCENE',
            Age: 'GREENLANDIAN',
            SubAge: 'EARLY HOLOCENE'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[0].Stage).toBe('GREENLANDIAN')
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[0].DetailedClassification).toBe('EARLY HOLOCENE')
  })

  test('should delete chronostratigraphic unit', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'MESOZOIC',
            Period: 'CRETACEOUS',
            Epoch: '',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits).toHaveLength(1)
    expect(parsed.PaleoTemporalCoverages[0].ChronostratigraphicUnits[0].Epoch).toBe('HOLOCENE')
  })

  test('should delete parent property when the last chronounit is removed', async () => {
    const singleChronoXml = {
      ShortName: 'SINGLE_CHRONO',
      PaleoTemporalCoverages: [
        {
          ChronostratigraphicUnits: [
            {
              Eon: 'PHANEROZOIC'
            }
          ]
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singleChronoXml,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: '',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.PaleoTemporalCoverages).toBeUndefined()
  })

  test('should handle missing ChronostratigraphicUnits element', async () => {
    const xmlWithoutChronoUnits = {
      ShortName: 'NO_CHRONO',
      Version: '001'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutChronoUnits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'MESOZOIC',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should return false if oldKeywordObject is missing during chronounits correction', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace'
          // Missing oldKeywordObject
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should return false if ChronostratigraphicUnits is not an array during chronounits correction', async () => {
    const mockUmmcInvalidUnits = {
      ShortName: 'CHRONO_TEST',
      PaleoTemporalCoverages: [
        {
          // ChronostratigraphicUnits is missing or invalid
          ChronostratigraphicUnits: null
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcInvalidUnits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          oldKeywordObject: { Eon: 'PHANEROZOIC' },
          newKeywordObject: { Eon: 'PROTEROZOIC' }
        }
      ]
    })

    // The function should return false (correctionCount 0)
    // because it safely handles the non-array case
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should return false if the specific chronostratigraphic unit is not found', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          oldKeywordObject: {
            Eon: 'NON_EXISTENT', // Triggers line 181
            Era: '',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: '',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should return false if action is invalid (neither delete nor replace)', async () => {
    const mockUmmcWithChronounitsForInvalidAction = {
      ShortName: 'CHRONO_TEST',
      PaleoTemporalCoverages: [
        {
          ChronostratigraphicUnits: [
            {
              Eon: 'PHANEROZOIC',
              Era: 'MESOZOIC'
            }
          ]
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithChronounitsForInvalidAction,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'invalid_action', // Triggers fall-through to line 221
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'MESOZOIC',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    // The function returns false because it matched a unit but had an invalid action
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })
})

describe('when applying IDN node UMM-C corrections', () => {
  const mockUmmcWithIdnNodes = {
    ShortName: 'IDN_NODE_TEST',
    Version: '001',
    DirectoryNames: [
      {
        ShortName: 'ARCTIC',
        LongName: 'Arctic Council'
      },
      {
        ShortName: 'USA/NASA',
        LongName: 'National Aeronautics and Space Administration'
      }
    ]
  }

  test('should apply a replace correction', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ARCTIC'
          },
          newKeywordObject: {
            ShortName: 'NEW-ARCTIC'
          },
          newLongName: 'Updated Arctic Council'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DirectoryNames[0].ShortName).toBe('NEW-ARCTIC')
    expect(parsed.DirectoryNames[0].LongName).toBe('Updated Arctic Council')
    expect(parsed.DirectoryNames[1].ShortName).toBe('USA/NASA')
  })

  test('should delete LongName if newLongName is empty', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'USA/NASA'
          },
          newKeywordObject: {
            ShortName: 'NASA-UPDATED'
          },
          newLongName: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DirectoryNames[1].ShortName).toBe('NASA-UPDATED')
    expect(parsed.DirectoryNames[1].LongName).toBeUndefined()
    expect(parsed.DirectoryNames[0].LongName).toBe('Arctic Council')
  })

  test('should delete a specific IDN_Node from an array', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'ARCTIC'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DirectoryNames).toHaveLength(1)
    expect(parsed.DirectoryNames[0].ShortName).toBe('USA/NASA')
  })

  test('should delete parent DirectoryNames property when the last node is removed', async () => {
    const singleNodeJson = {
      ShortName: 'TEST',
      DirectoryNames: [
        {
          ShortName: 'ONLY-ONE'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singleNodeJson,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'ONLY-ONE'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DirectoryNames).toBeUndefined()
  })

  test('should handle missing DirectoryNames element', async () => {
    const emptyJson = {
      ShortName: 'TEST',
      Version: '001'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: emptyJson,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ARCTIC'
          },
          newKeywordObject: {
            ShortName: 'A > B'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })
})

describe('when applying instrument UMM-C corrections', () => {
  const mockUmmcWithInstruments = {
    ShortName: 'Instruments_Test',
    Version: '001',
    Platforms: [
      {
        Type: 'Aircraft',
        ShortName: 'UC-12B',
        LongName: 'NASA Langley Beechcraft UC-12B Huron',
        Instruments: [
          {
            ShortName: 'IRMSS',
            LongName: 'Infrared Multispectral Scanner'
          }
        ]
      },
      {
        Type: 'Earth Observation Satellites',
        ShortName: 'MINTS',
        LongName: 'Multi-Scale Integrated Intelligent Interactive Sensing Consortium',
        Instruments: [
          {
            ShortName: 'LISS-II',
            LongName: 'Linear Imaging Self Scanning Sensor II'
          }
        ]
      }
    ]
  }

  test('should return false if Platforms is not an array or is empty during instruments correction', async () => {
    // Provide a mock UMM-C that lacks a Platforms array
    const mockUmmcNoPlatforms = {
      ShortName: 'INSTRUMENT_TEST'
      // Platforms is missing
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcNoPlatforms,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: { ShortName: 'ANY_INST' }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should return false if oldKeywordObject.ShortName is missing during instruments correction', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          // Missing ShortName in oldKeywordObject
          oldKeywordObject: { },
          newKeywordObject: { ShortName: 'INST-2' }
        }
      ]
    })

    // The function returns false at line 311
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should return false if instruments correction action is unsupported', async () => {
    const mockUmmcWithInstrumentsForInvalidAction = {
      ShortName: 'INSTRUMENT_TEST',
      Platforms: [
        {
          ShortName: 'PLATFORM-1',
          Instruments: [
            { ShortName: 'INST-1' }
          ]
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithInstrumentsForInvalidAction,
      corrections: [
        {
          scheme: 'instruments',
          action: 'unsupported_action',
          oldKeywordObject: { ShortName: 'INST-1' },
          newKeywordObject: { ShortName: 'INST-2' }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should apply long name correction to first Instrument', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'IRMSS'
          },
          newKeywordObject: {
            ShortName: 'IRMSS'
          },
          newLongName: 'Updated Infrared Multispectral Scanner'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[0].Instruments[0].LongName).toBe('Updated Infrared Multispectral Scanner')
    expect(parsed.Platforms[1].Instruments[0].LongName).toBe('Linear Imaging Self Scanning Sensor II')
  })

  test('should update both short name and long name', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'LISS-II'
          },
          newKeywordObject: {
            ShortName: 'LISSUPDATE-II'
          },
          newLongName: 'Linear Imaging Self Scanning Sensor II Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[1].Instruments[0].ShortName).toBe('LISSUPDATE-II')
    expect(parsed.Platforms[1].Instruments[0].LongName).toBe('Linear Imaging Self Scanning Sensor II Updated')
  })

  test('should delete Instrument', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'IRMSS'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[0].Instruments).toBeUndefined()
    expect(parsed.Platforms[1].Instruments[0].ShortName).toBe('LISS-II')
  })

  test('should delete LongName if newLongName is empty', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'IRMSS'
          },
          newKeywordObject: {
            ShortName: 'NEW-SHORT'
          },
          newLongName: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[0].Instruments[0].ShortName).toBe('NEW-SHORT')
    expect(parsed.Platforms[0].Instruments[0].LongName).toBeUndefined()
  })

  test('should handle missing Instrument element', async () => {
    const xmlWithoutInstrument = {
      ShortName: 'No_instrument',
      Platforms: [
        {
          Type: 'Aircraft',
          ShortName: 'UC-12B'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutInstrument,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'IRMSS'
          },
          newKeywordObject: {
            ShortName: 'IRMSS1'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })
})

describe('when applying ISO topic category UMM-C corrections', () => {
  const mockUmmcWithCategories = {
    ShortName: 'ISO_TEST',
    ISOTopicCategories: [
      'BIOTA',
      'CLIMATOLOGY/METEOROLOGY/ATMOSPHERE'
    ]
  }

  test('should replace a specific category in an array', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithCategories,
      corrections: [
        {
          scheme: 'isotopiccategory',
          action: 'replace',
          oldKeywordObject: {
            Value: 'CLIMATOLOGY/METEOROLOGY/ATMOSPHERE'
          },
          newKeywordObject: {
            Value: 'FARMING'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ISOTopicCategories).toContain('FARMING')
    expect(parsed.ISOTopicCategories).toContain('BIOTA')
    expect(parsed.ISOTopicCategories).not.toContain('CLIMATOLOGY/METEOROLOGY/ATMOSPHERE')
  })

  test('should delete a specific category from an array', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithCategories,
      corrections: [
        {
          scheme: 'isotopiccategory',
          action: 'delete',
          oldKeywordObject: {
            Value: 'BIOTA'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ISOTopicCategories).not.toContain('BIOTA')
    expect(parsed.ISOTopicCategories).toContain('CLIMATOLOGY/METEOROLOGY/ATMOSPHERE')
  })

  test('should delete the property entirely when the last item is removed', async () => {
    const singleJson = {
      ShortName: 'TEST',
      ISOTopicCategories: ['LAST_ONE']
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singleJson,
      corrections: [
        {
          scheme: 'isotopiccategory',
          action: 'delete',
          oldKeywordObject: {
            Value: 'LAST_ONE'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ISOTopicCategories).toBeUndefined()
  })

  test('should handle missing ISOTopicCategories', async () => {
    const emptyJson = {
      ShortName: 'TEST'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: emptyJson,
      corrections: [
        {
          scheme: 'isotopiccategory',
          action: 'replace',
          oldKeywordObject: {
            Value: 'BIOTA'
          },
          newKeywordObject: {
            Value: 'FARMING'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })
})

describe('when applying location UMM-C corrections', () => {
  const mockUmmcWithLocations = {
    ShortName: 'LOCATION_TEST',
    Version: '001',
    LocationKeywords: [
      {
        Category: 'CONTINENT',
        Type: 'NORTH AMERICA'
      },
      {
        Category: 'OCEAN',
        Type: 'PACIFIC OCEAN'
      },
      {
        Category: 'CONTINENT',
        Type: 'NORTH AMERICA',
        Subregion1: 'UNITED STATES OF AMERICA'
      }
    ]
  }

  test('should apply location correction to first location', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          oldKeywordObject: {
            Category: 'CONTINENT',
            Type: 'NORTH AMERICA',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          },
          newKeywordObject: {
            Category: 'CONTINENT',
            Type: 'SOUTH AMERICA',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.LocationKeywords[0].Type).toBe('SOUTH AMERICA')
    expect(parsed.LocationKeywords[1].Type).toBe('PACIFIC OCEAN')

    const northAmericaCount = parsed.LocationKeywords.filter((l) => l.Type === 'NORTH AMERICA').length
    expect(northAmericaCount).toBe(1)
  })

  test('should apply location correction with subregion', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          oldKeywordObject: {
            Category: 'CONTINENT',
            Type: 'NORTH AMERICA',
            Subregion1: 'UNITED STATES OF AMERICA',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          },
          newKeywordObject: {
            Category: 'CONTINENT',
            Type: 'NORTH AMERICA',
            Subregion1: 'CANADA',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.LocationKeywords[2].Subregion1).toBe('CANADA')
  })

  test('should add multiple subregion levels', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          oldKeywordObject: {
            Category: 'CONTINENT',
            Type: 'NORTH AMERICA',
            Subregion1: 'UNITED STATES OF AMERICA',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          },
          newKeywordObject: {
            Category: 'CONTINENT',
            Type: 'NORTH AMERICA',
            Subregion1: 'UNITED STATES OF AMERICA',
            Subregion2: 'CALIFORNIA',
            Subregion3: 'LOS ANGELES',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.LocationKeywords[2].Subregion1).toBe('UNITED STATES OF AMERICA')
    expect(parsed.LocationKeywords[2].Subregion2).toBe('CALIFORNIA')
    expect(parsed.LocationKeywords[2].Subregion3).toBe('LOS ANGELES')
  })

  test('should remove subregion levels when moving to higher level', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          oldKeywordObject: {
            Category: 'CONTINENT',
            Type: 'NORTH AMERICA',
            Subregion1: 'UNITED STATES OF AMERICA',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          },
          newKeywordObject: {
            Category: 'CONTINENT',
            Type: 'EUROPE',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.LocationKeywords[2].Type).toBe('EUROPE')
    expect(parsed.LocationKeywords[2].Subregion1).toBeUndefined()
  })

  test('should delete location at index', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'delete',
          oldKeywordObject: {
            Category: 'OCEAN',
            Type: 'PACIFIC OCEAN',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.LocationKeywords).toHaveLength(2)
    expect(parsed.LocationKeywords.find((l) => l.Type === 'PACIFIC OCEAN')).toBeUndefined()
  })

  test('should delete parent LocationKeywords when last location is removed', async () => {
    const singleLocationJson = {
      ShortName: 'SINGLE_LOCATION',
      LocationKeywords: [
        {
          Category: 'OCEAN',
          Type: 'ATLANTIC OCEAN'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singleLocationJson,
      corrections: [
        {
          scheme: 'locations',
          action: 'delete',
          oldKeywordObject: {
            Category: 'OCEAN',
            Type: 'ATLANTIC OCEAN',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.LocationKeywords).toBeUndefined()
  })

  test('should handle missing LocationKeywords element', async () => {
    const xmlWithoutLocation = {
      ShortName: 'NO_LOCATION'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutLocation,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          oldKeywordObject: {
            Category: 'OCEAN',
            Type: 'ATLANTIC OCEAN',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          },
          newKeywordObject: {
            Category: 'OCEAN',
            Type: 'PACIFIC OCEAN',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })
})

describe('when applying platform UMM-C corrections', () => {
  const mockUmmcWithPlatforms = {
    ShortName: 'Platforms_Test',
    Version: '001',
    Platforms: [
      {
        Type: 'Earth Observation Satellites',
        ShortName: 'SPOT-4',
        LongName: 'Systeme Observation de la Terre-4',
        Instruments: [
          {
            ShortName: 'VEGETATION-1',
            LongName: 'VEGETATION INSTRUMENT 1 (SPOT 4)'
          }
        ]
      },
      {
        Type: 'Aircraft',
        ShortName: 'SPOT-5',
        LongName: 'Systeme Observation de la Terre-5',
        Instruments: [
          {
            ShortName: 'VEGETATION-2',
            LongName: 'VEGETATION INSTRUMENT 2 (SPOT 5)'
          }
        ]
      }
    ]
  }

  test('should apply long name correction to first Platform', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-4'
          },
          newKeywordObject: {
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-4'
          },
          newLongName: 'Systeme Observation de la Terre-4 Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[0].LongName).toBe('Systeme Observation de la Terre-4 Updated')
    expect(parsed.Platforms[1].LongName).toBe('Systeme Observation de la Terre-5')
    expect(parsed.Platforms[0].Instruments[0].ShortName).toBe('VEGETATION-1')
  })

  test('should update both short name and long name', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Type: 'Aircraft',
            ShortName: 'SPOT-5'
          },
          newKeywordObject: {
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-7-New'
          },
          newLongName: 'Systeme Observation de la Terre-7 New'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[1].Type).toBe('Earth Observation Satellites')
    expect(parsed.Platforms[1].ShortName).toBe('SPOT-7-New')
    expect(parsed.Platforms[1].LongName).toBe('Systeme Observation de la Terre-7 New')
  })

  test('should delete Platform', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'SPOT-4'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms).toHaveLength(1)
    expect(parsed.Platforms[0].ShortName).toBe('SPOT-5')
  })

  test('should delete parent Platforms when last platform is removed', async () => {
    const singlePlatformJson = {
      ShortName: 'SINGLE_PLAT_TEST',
      Platforms: [
        {
          Type: 'Aircraft',
          ShortName: 'A1'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singlePlatformJson,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'A1'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms).toBeUndefined()
  })

  test('should delete LongName if newLongName is empty', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'SPOT-4'
          },
          newKeywordObject: {
            Type: 'Aircraft',
            ShortName: 'NEW-SHORT'
          },
          newLongName: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[0].ShortName).toBe('NEW-SHORT')
    expect(parsed.Platforms[0].LongName).toBeUndefined()
  })

  test('should handle missing Platforms element', async () => {
    const xmlWithoutPlatform = {
      ShortName: 'NO_PLATFORM'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutPlatform,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'SPOT-5'
          },
          newKeywordObject: {
            ShortName: 'SPOT-7'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })
})

describe('when applying ProcessingLevel UMM-C corrections', () => {
  const mockUmmcWithProcessingLevel = {
    ShortName: 'PROC_TEST',
    ProcessingLevel: {
      Id: '1B',
      ProcessingLevelDescription: 'Level 1B data products'
    }
  }

  test('should successfully update the ProcessingLevel Id', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProcessingLevel,
      corrections: [
        {
          scheme: 'productlevelid',
          action: 'replace',
          oldKeywordObject: {
            Value: '1B'
          },
          newKeywordObject: {
            Value: '2'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ProcessingLevel.Id).toBe('2')
    expect(parsed.ProcessingLevel.ProcessingLevelDescription).toBe('Level 1B data products')
  })

  test('should delete ProcessingLevel when action is delete', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProcessingLevel,
      corrections: [
        {
          scheme: 'productlevelid',
          action: 'delete',
          oldKeywordObject: {
            Value: '1B'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ProcessingLevel).toBeUndefined()
  })

  test('should return false if newKeywordObject is empty or invalid', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProcessingLevel,
      corrections: [
        {
          scheme: 'productlevelid',
          action: 'replace',
          oldKeywordObject: {
            Value: '1B'
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(0)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ProcessingLevel.Id).toBe('1B')
  })
})

describe('when applying project UMM-C corrections', () => {
  const mockUmmcWithProjects = {
    ShortName: 'Projects_Test',
    Version: '001',
    Projects: [
      {
        ShortName: 'ESIP',
        LongName: 'Earth Science Information Partners Program'
      },
      {
        ShortName: 'ALIENS',
        LongName: 'Aliens in Antarctica'
      }
    ]
  }

  test('should apply long name correction to first Project', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ESIP'
          },
          newKeywordObject: {
            ShortName: 'ESIP'
          },
          newLongName: 'Updated Earth Science Information Partners Program'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Projects[0].LongName).toBe('Updated Earth Science Information Partners Program')
    expect(parsed.Projects[1].LongName).toBe('Aliens in Antarctica')
  })

  test('should update both short name and long name', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ALIENS'
          },
          newKeywordObject: {
            ShortName: 'ALIENS UP'
          },
          newLongName: 'Aliens research in Antarctica'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Projects[1].ShortName).toBe('ALIENS UP')
    expect(parsed.Projects[1].LongName).toBe('Aliens research in Antarctica')
  })

  test('should delete Project', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'ESIP'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Projects).toHaveLength(1)
    expect(parsed.Projects[0].ShortName).toBe('ALIENS')
  })

  test('should delete parent Projects when last project is removed', async () => {
    const singleProjectJson = {
      ShortName: 'TEST',
      Projects: [
        {
          ShortName: 'SINGLE-PROJ',
          LongName: 'Single Project Test'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singleProjectJson,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'SINGLE-PROJ'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Projects).toBeUndefined()
  })

  test('should delete LongName if newLongName is empty', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ESIP'
          },
          newKeywordObject: {
            ShortName: 'ONLY_SHORT'
          },
          newLongName: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Projects[0].ShortName).toBe('ONLY_SHORT')
    expect(parsed.Projects[0].LongName).toBeUndefined()
    expect(parsed.Projects[1].LongName).toBe('Aliens in Antarctica')
  })

  test('should handle missing Projects element', async () => {
    const xmlWithoutProject = {
      ShortName: 'No_project'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutProject,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ESIP'
          },
          newKeywordObject: {
            ShortName: 'ESIP-7'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })
})

describe('when applying provider UMM-C corrections', () => {
  const mockUmmcWithProviders = {
    ShortName: 'Providers_Test',
    Version: '001',
    DataCenters: [
      {
        ShortName: 'BROWN/GEO',
        LongName: 'Department of Geological Sciences, Brown University',
        Roles: ['ARCHIVER']
      },
      {
        ShortName: 'ESRI-CANADA',
        LongName: 'Environmental Systems Research Institute, Inc. - Canada',
        Roles: ['DISTRIBUTOR']
      }
    ]
  }

  test('should apply long name correction to first provider', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'BROWN/GEO'
          },
          newKeywordObject: {
            ShortName: 'BROWN/GEO'
          },
          newLongName: 'Department of Geological Sciences, Brown University East'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DataCenters[0].LongName).toBe('Department of Geological Sciences, Brown University East')
    expect(parsed.DataCenters[1].LongName).toBe('Environmental Systems Research Institute, Inc. - Canada')
  })

  test('should update both short name and long name', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ESRI-CANADA'
          },
          newKeywordObject: {
            ShortName: 'ESRI2-CANADA'
          },
          newLongName: 'Environmental Systems Research Institute 2, Inc. - Canada'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DataCenters[1].ShortName).toBe('ESRI2-CANADA')
    expect(parsed.DataCenters[1].LongName).toBe('Environmental Systems Research Institute 2, Inc. - Canada')
  })

  test('should delete Provider', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'ESRI-CANADA'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DataCenters).toHaveLength(1)
    expect(parsed.DataCenters[0].ShortName).toBe('BROWN/GEO')
  })

  test('should delete parent DataCenters when last provider is removed', async () => {
    const singleOrgJson = {
      ShortName: 'TEST',
      DataCenters: [
        {
          ShortName: 'O'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singleOrgJson,
      corrections: [
        {
          scheme: 'providers',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'O'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DataCenters).toBeUndefined()
  })

  test('should delete LongName if newLongName is empty', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'BROWN/GEO'
          },
          newKeywordObject: {
            ShortName: 'ONLY_SHORT'
          },
          newLongName: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.DataCenters[0].ShortName).toBe('ONLY_SHORT')
    expect(parsed.DataCenters[0].LongName).toBeUndefined()
    expect(parsed.DataCenters[0].Roles).toEqual(['ARCHIVER'])
  })

  test('should handle missing DataCenters element', async () => {
    const xmlWithoutProvider = {
      ShortName: 'No_provider'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutProvider,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ESRI-CANADA'
          },
          newKeywordObject: {
            ShortName: 'ESRI2-CANADA'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })
})

describe('when applying related URL content type UMM-C corrections', () => {
  const mockUmmcWithRelatedURLs = {
    ShortName: 'RELATED_URL_TEST',
    Version: '001',
    RelatedUrls: [
      {
        URLContentType: 'DistributionURL',
        Type: 'GET DATA',
        URL: 'https://example.com/data'
      },
      {
        URLContentType: 'PublicationURL',
        Type: 'VIEW RELATED INFORMATION',
        Subtype: 'ANOMALIES',
        URL: 'https://example.com/anomalies'
      },
      {
        URLContentType: 'VisualizationURL',
        Type: 'GET RELATED VISUALIZATION',
        Subtype: 'GIBS',
        URL: 'https://example.com/gibs'
      }
    ]
  }

  test('should apply URL content type correction to first Related URL', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET SERVICE',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.RelatedUrls[0].Type).toBe('GET SERVICE')
    expect(parsed.RelatedUrls[1].Type).toBe('VIEW RELATED INFORMATION')
    expect(parsed.RelatedUrls[2].Type).toBe('GET RELATED VISUALIZATION')
  })

  test('should update both type and subtype', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'PublicationURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'ANOMALIES'
          },
          newKeywordObject: {
            URLContentType: 'PublicationURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'USER GUIDE'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.RelatedUrls[1].Subtype).toBe('USER GUIDE')
    expect(parsed.RelatedUrls[1].Type).toBe('VIEW RELATED INFORMATION')
  })

  test('should add subtype to URL that only had type', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: 'DIRECT DOWNLOAD'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.RelatedUrls[0].Type).toBe('GET DATA')
    expect(parsed.RelatedUrls[0].Subtype).toBe('DIRECT DOWNLOAD')
  })

  test('should remove subtype when moving to type-only', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'VisualizationURL',
            Type: 'GET RELATED VISUALIZATION',
            Subtype: 'GIBS'
          },
          newKeywordObject: {
            URLContentType: 'VisualizationURL',
            Type: 'GET RELATED VISUALIZATION',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.RelatedUrls[2].Type).toBe('GET RELATED VISUALIZATION')
    expect(parsed.RelatedUrls[2].Subtype).toBeUndefined()
  })

  test('should delete RelatedUrl when all fields are empty', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'delete',
          oldKeywordObject: {
            URLContentType: 'PublicationURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'ANOMALIES'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.RelatedUrls).toHaveLength(2)
    expect(parsed.RelatedUrls.find((u) => u.Subtype === 'ANOMALIES')).toBeUndefined()
  })

  test('should delete RelatedUrls from document if it becomes empty after deletion', async () => {
    const mockUmmcRelatedUrls = {
      ShortName: 'URL_TEST',
      RelatedUrls: [
        {
          URLContentType: 'PublicationURL',
          Type: 'VIEW RELATED INFORMATION',
          Subtype: 'General Documentation',
          URL: 'https://example.com'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcRelatedUrls,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'delete',
          oldKeywordObject: {
            URLContentType: 'PublicationURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'General Documentation'
          }
        }
      ]
    })

    const parsed = JSON.parse(result.correctedMetadata)
    // The RelatedUrls array should be empty, triggering the delete logic at line 456
    expect(parsed.RelatedUrls).toBeUndefined()
  })

  test('should handle missing RelatedUrls element', async () => {
    const xmlWithoutRelatedURL = {
      ShortName: 'NO_URL'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutRelatedURL,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET SERVICE',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should remove URLContentType fields when all are empty', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcWithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: '',
            Type: '',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.RelatedUrls[0].URLContentType).toBeUndefined()
    expect(parsed.RelatedUrls[0].Type).toBeUndefined()
    expect(parsed.RelatedUrls[0].URL).toBe('https://example.com/data')
  })
})

describe('when applying science keyword UMM-C corrections', () => {
  const mockUmmcSimpleKeywords = {
    ShortName: 'TEST_COLLECTION',
    ScienceKeywords: [
      {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: 'LEGACY AEROSOLS'
      }
    ]
  }

  const mockUmmcComplexKeywords = {
    ShortName: 'DEM_100M',
    Version: '001',
    ScienceKeywords: [
      {
        Category: 'EARTH SCIENCE',
        Topic: 'LAND SURFACE',
        Term: 'TOPOGRAPHY',
        VariableLevel1: 'LANDFORMS',
        VariableLevel2: 'DEM'
      },
      {
        Category: 'EARTH SCIENCE',
        Topic: 'LAND SURFACE',
        Term: 'TOPOGRAPHY',
        VariableLevel1: 'TERRAIN ELEVATION',
        VariableLevel2: 'DIGITAL TERRAIN MODEL'
      }
    ]
  }

  test('should apply science keyword renaming correction', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimpleKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
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
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: 'AEROSOLS RENAMED',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.stubbed).toBe(false)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].Category).toBe('EARTH SCIENCE')
    expect(parsed.ScienceKeywords[0].Topic).toBe('ATMOSPHERE')
    expect(parsed.ScienceKeywords[0].Term).toBe('AEROSOLS')
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('AEROSOLS RENAMED')
  })

  test('should apply science keyword hierarchy move', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimpleKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
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
            Category: 'EARTH SCIENCE',
            Topic: 'AIR QUALITY',
            Term: 'AEROSOLS',
            VariableLevel1: 'LEGACY AEROSOLS',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].Topic).toBe('AIR QUALITY')
    expect(parsed.ScienceKeywords[0].Term).toBe('AEROSOLS')
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('LEGACY AEROSOLS')
  })

  test('should apply hierarchy move with renaming at same level', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcComplexKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'LANDFORMS',
            VariableLevel2: 'DEM',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'ELEVATION',
            VariableLevel1: 'TERRAIN FEATURES',
            VariableLevel2: 'DIGITAL ELEVATION MODEL',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].Term).toBe('ELEVATION')
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('TERRAIN FEATURES')
    expect(parsed.ScienceKeywords[0].VariableLevel2).toBe('DIGITAL ELEVATION MODEL')
    expect(parsed.ScienceKeywords[1].Term).toBe('TOPOGRAPHY')
  })

  test('should apply correction to second keyword in array', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcComplexKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'TERRAIN ELEVATION',
            VariableLevel2: 'DIGITAL TERRAIN MODEL',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'ELEVATION DATA',
            VariableLevel2: 'DIGITAL ELEVATION DATA',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('LANDFORMS')
    expect(parsed.ScienceKeywords[1].VariableLevel1).toBe('ELEVATION DATA')
    expect(parsed.ScienceKeywords[1].VariableLevel2).toBe('DIGITAL ELEVATION DATA')
  })

  test('should remove science keyword when delete action is applied', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcComplexKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'LANDFORMS',
            VariableLevel2: 'DEM',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords).toHaveLength(1)
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('TERRAIN ELEVATION')
  })

  test('should delete parent ScienceKeywords when last keyword is removed', async () => {
    const singleKeywordJson = {
      ShortName: 'DELETE_ONLY_KEYWORD',
      ScienceKeywords: [
        {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE'
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: singleKeywordJson,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: '',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords).toBeUndefined()
  })

  test('should apply multiple science keyword corrections', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcComplexKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'LANDFORMS',
            VariableLevel2: 'DEM',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'LANDFORMS',
            VariableLevel2: 'DIGITAL ELEVATION MODEL',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        },
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'TERRAIN ELEVATION',
            VariableLevel2: 'DIGITAL TERRAIN MODEL',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'TERRESTRIAL HYDROSPHERE',
            Term: 'SURFACE WATER',
            VariableLevel1: 'ELEVATION',
            VariableLevel2: 'DTM',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].VariableLevel2).toBe('DIGITAL ELEVATION MODEL')
    expect(parsed.ScienceKeywords[1].Topic).toBe('TERRESTRIAL HYDROSPHERE')
    expect(parsed.ScienceKeywords[1].Term).toBe('SURFACE WATER')
    expect(parsed.ScienceKeywords[1].VariableLevel2).toBe('DTM')
  })

  test('should apply category-level change', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimpleKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
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
            Category: 'EARTH SCIENCE SERVICES',
            Topic: 'DATA ANALYSIS AND VISUALIZATION',
            Term: 'AEROSOL ANALYSIS',
            VariableLevel1: 'LEGACY AEROSOLS',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].Category).toBe('EARTH SCIENCE SERVICES')
    expect(parsed.ScienceKeywords[0].Topic).toBe('DATA ANALYSIS AND VISUALIZATION')
    expect(parsed.ScienceKeywords[0].Term).toBe('AEROSOL ANALYSIS')
  })

  test('should handle missing ScienceKeywords element', async () => {
    const xmlWithoutKeywords = {
      ShortName: 'NO_KEYWORDS'
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: xmlWithoutKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: '',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'AIR QUALITY',
            Term: '',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should skip correction when keyword path does not match', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimpleKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'NON_EXISTENT_TOPIC',
            Term: 'AEROSOLS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'AIR QUALITY',
            Term: 'AEROSOLS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('LEGACY AEROSOLS')
  })
})

describe('when applying DataFormat UMM-C corrections', () => {
  test('should apply dataformat correction when oldKeywordObject matches one node path', async () => {
    const mockUmmcDataFormat = {
      ShortName: 'FORMAT_TEST',
      ArchiveAndDistributionInformation: {
        FileArchiveInformation: [{
          Format: 'NETCDF-4'
        }],
        FileDistributionInformation: [{
          Format: 'HDF5'
        }]
      }
    }

    const corrections = [
      {
        scheme: 'dataformat',
        action: 'replace',
        oldKeywordObject: {
          Value: 'NETCDF-4'
        },
        newKeywordObject: {
          Value: 'ZARR'
        }
      }
    ]

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcDataFormat,
      corrections
    })

    // Verify that the correction only processes where the match exists
    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    // Verify the specific path was updated
    expect(parsed.ArchiveAndDistributionInformation.FileArchiveInformation[0].Format).toBe('ZARR')
    // Verify the path that did not match the oldKeywordObject remains unchanged
    expect(parsed.ArchiveAndDistributionInformation.FileDistributionInformation[0].Format).toBe('HDF5')
  })

  test('should apply dataformat correction when oldKeywordObject matches both node paths', async () => {
    const mockUmmcDataFormat = {
      ShortName: 'FORMAT_TEST',
      ArchiveAndDistributionInformation: {
        FileArchiveInformation: [{
          Format: 'NETCDF-4'
        }],
        FileDistributionInformation: [{
          Format: 'NETCDF-4'
        }]
      }
    }

    const corrections = [
      {
        scheme: 'dataformat',
        action: 'replace',
        oldKeywordObject: {
          Value: 'NETCDF-4'
        },
        newKeywordObject: {
          Value: 'ZARR'
        }
      }
    ]

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcDataFormat,
      corrections
    })

    // Verify that the correction only processes where the match exists
    // expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    console.log('parsed:', parsed)
    // Verify the specific path was updated
    expect(parsed.ArchiveAndDistributionInformation.FileArchiveInformation[0].Format).toBe('ZARR')
    // Verify the path that did not match the oldKeywordObject remains unchanged
    expect(parsed.ArchiveAndDistributionInformation.FileDistributionInformation[0].Format).toBe('ZARR')
  })
})

describe('when verifying edge cases', () => {
  test('should handle empty corrections array', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections: []
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
    expect(result.stubbed).toBe(false)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ShortName).toBe('TEST_COLLECTION')
  })

  test('should handle corrections with missing action defaulting to replace', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections: [
        {
          scheme: 'sciencekeywords',
          // Action is missing, should default to 'replace'
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'OCEANS',
            Term: 'MARINE SEDIMENTS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].Topic).toBe('OCEANS')
  })

  test('should preserve JSON structure and formatting', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections: []
    })

    expect(() => JSON.parse(result.correctedMetadata)).not.toThrow()

    const parsed = JSON.parse(result.correctedMetadata)
    const original = mockUmmcSimple

    expect(parsed).toEqual(original)
  })

  test('should handle deeply nested structures', async () => {
    const deeplyNested = {
      ShortName: 'DEEP_TEST',
      Platforms: [
        {
          ShortName: 'P1',
          Instruments: [
            {
              ShortName: 'I1',
              ComposedOf: [
                {
                  ShortName: 'CHILD1',
                  LongName: 'Child Instrument 1'
                }
              ]
            }
          ]
        }
      ]
    }

    const result = await applyUmmcMetadataCorrections({
      metadataPayload: deeplyNested,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'I1'
          },
          newKeywordObject: {
            ShortName: 'I1-UPDATED'
          },
          newLongName: 'Instrument 1 Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[0].Instruments[0].ShortName).toBe('I1-UPDATED')
    expect(parsed.Platforms[0].Instruments[0].ComposedOf).toBeDefined()
    expect(parsed.Platforms[0].Instruments[0].ComposedOf[0].ShortName).toBe('CHILD1')
  })

  test('should maintain array order after corrections', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcComplex,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'SURFACE THERMAL PROPERTIES',
            VariableLevel1: 'LAND SURFACE TEMPERATURE',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'SURFACE THERMAL PROPERTIES',
            VariableLevel1: 'SURFACE TEMPERATURE',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.ScienceKeywords[0].VariableLevel1).toBe('SURFACE TEMPERATURE')
    expect(parsed.ScienceKeywords[1].Term).toBe('LAND USE/LAND COVER')
  })

  test('should handle corrections that do not match any elements', async () => {
    const result = await applyUmmcMetadataCorrections({
      metadataPayload: mockUmmcSimple,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'NON_EXISTENT_PLATFORM'
          },
          newKeywordObject: {
            ShortName: 'NEW_PLATFORM'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)

    const parsed = JSON.parse(result.correctedMetadata)
    expect(parsed.Platforms[0].ShortName).toBe('SPOT-4')
  })
})
