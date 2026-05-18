import { readFileSync } from 'fs'
import { join } from 'path'

import {
  describe,
  expect,
  test
} from 'vitest'

import { applyDif10MetadataCorrections } from '../applyDif10MetadataCorrections'

const mockDif10 = `
<DIF>
    <Entry_ID>
        <Short_Name>Test_Collection</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
        <Term>AEROSOLS</Term>
    </Science_Keywords>
    <Platform>
        <Type>In Situ Land-based Platforms</Type>
        <Short_Name>GROUND STATIONS</Short_Name>
    </Platform>
    <Location>
        <Location_Category>GEOGRAPHIC REGION</Location_Category>
        <Location_Type>ARCTIC</Location_Type>
    </Location>
</DIF>`

describe('applyDif10MetadataCorrections', () => {
  test('returns early if metadataPayload is missing', async () => {
    const result = await applyDif10MetadataCorrections({ metadataPayload: null })
    expect(result.correctionCount).toBe(0)
    expect(result.stubbed).toBe(true)
  })

  test('applies multiple corrections from different schemes sequentially', async () => {
    const corrections = [
      {
        scheme: 'sciencekeywords',
        action: 'replace',
        ummPath: ['ScienceKeywords', 0],
        newKeywordPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS'
      },
      {
        scheme: 'platforms',
        action: 'replace',
        ummPath: ['Platforms', 0],
        newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > C-130'
      }
    ]

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections
    })

    expect(result.correctionCount).toBe(2)
    expect(result.correctionsApplied).toHaveLength(2)

    // Check XML Content
    expect(result.correctedMetadata).toContain('<Topic>OCEANS</Topic>')
    expect(result.correctedMetadata).toContain('<Short_Name>C-130</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Topic>ATMOSPHERE</Topic>')
  })

  test('handles unknown schemes gracefully by ignoring them', async () => {
    const corrections = [
      {
        scheme: 'invalid_scheme',
        action: 'replace',
        ummPath: [0],
        newKeywordPath: 'Should Not Apply'
      }
    ]

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
    // Metadata should remain unchanged (save for standard formatting)
    expect(result.correctedMetadata).toContain('<Term>AEROSOLS</Term>')
  })

  test('handles delete action for Locations', async () => {
    const corrections = [
      {
        scheme: 'locations',
        action: 'delete',
        ummPath: ['SpatialKeywords', 0]
      }
    ]

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).not.toContain('<Location_Category>GEOGRAPHIC REGION</Location_Category>')
    expect(result.correctedMetadata).not.toContain('<Location>')
  })

  test('verifies XML declaration and formatting', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections: []
    })

    expect(result.correctedMetadata).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(result.correctedMetadata).toContain('<DIF>')
  })
})

describe('Correct a DIF10', () => {
  test('returns a corrected DIF10', async () => {
    const mockDIF10Xml = readFileSync(
      join(__dirname, '../__mocks__/dif10.xml'),
      'utf-8'
    )

    const corrections = [
      {
        scheme: 'chronounits',
        ummPath: ['Chronostratigraphic_Unit', 0],
        oldKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > HOLOCENE >  > ',
        newKeywordPath: 'PHANEROZOIC > CENOZOIC > QUATERNARY > PLEISTOCENE >  > '
      },
      {
        scheme: 'platforms',
        action: 'replace',
        ummPath: ['Platform', 1],
        oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-5',
        newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-7-New',
        newLongName: 'Systeme Observation de la Terre-5 Updated'
      },
      {
        scheme: 'instruments',
        action: 'replace',
        ummPath: ['Platform', 0, 'Instrument', 1],
        oldKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS',
        newKeywordPath: 'Imaging Spectrometers/Radiometers >  >  >  > IRMSS',
        newLongName: 'Updated Infrared Multispectral Scanner'
      },
      {
        scheme: 'locations',
        action: 'replace',
        ummPath: ['Locations', 2],
        oldKeywordPath: 'CONTINENT > NORTH AMERICA > UNITED STATES OF AMERICA >  >  > ',
        newKeywordPath: 'CONTINENT > NORTH AMERICA > CANADA >  >  > '
      },
      {
        scheme: 'projects',
        ummPath: ['Project', 0],
        oldKeywordPath: 'D - F > ESIP',
        newKeywordPath: 'D - F > ESIP',
        newLongName: 'Updated Earth Science Information Partners Program'
      },
      {
        scheme: 'providers',
        action: 'replace',
        ummPath: ['Organization_Name', 0],
        oldKeywordPath: 'ACADEMIC >  >  >  > BROWN/GEO',
        newKeywordPath: 'ACADEMIC >  >  >  > BROWN/GEO',
        newLongName: 'Department of Geological Sciences, Brown University East'
      },
      {
        scheme: 'rucontenttype',
        action: 'replace',
        ummPath: ['Related_URL', 1, 'URL_Content_Type'],
        oldKeywordPath: 'DistributionURL > GET CAPABILITIES > OpenSearch',
        newKeywordPath: 'DistributionURL > GET CAPABILITIES > OGC WMS'
      },
      {
        scheme: 'sciencekeywords',
        action: 'replace',
        ummPath: ['Science_Keywords', 1],
        oldKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > TERRAIN ELEVATION > DIGITAL TERRAIN MODEL >  > ',
        newKeywordPath: 'EARTH SCIENCE > LAND SURFACE > TOPOGRAPHY > ELEVATION DATA > DIGITAL ELEVATION DATA >  > '
      }
    ]

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDIF10Xml,
      corrections
    })

    console.log('result:', result)
  })
})
