import { readFileSync } from 'fs'
import { join } from 'path'

import { DOMParser } from '@xmldom/xmldom'
import {
  describe,
  expect,
  test
} from 'vitest'
import xpath from 'xpath'

import {
  applyDif10MetadataCorrections as applyDif10MetadataCorrectionsRaw
} from '../applyDif10MetadataCorrections'

const applyDif10MetadataCorrections = (params = {}) => applyDif10MetadataCorrectionsRaw(params)

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

const mockDif10ForMetadataPreservation = `<DIF>
    <Entry_ID>
        <Short_Name>PRESERVATION_TEST</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Preservation Regression Test</Entry_Title>
    <Personnel>
        <Role>INVESTIGATOR</Role>
        <Contact_Person>
            <First_Name>RAY</First_Name>
            <Last_Name>DIBBLE</Last_Name>
            <Email>r.dibble@example.org</Email>
        </Contact_Person>
    </Personnel>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
        <Term>AEROSOLS</Term>
    </Science_Keywords>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>SOLID EARTH</Topic>
        <Term>TECTONICS</Term>
        <Variable_Level_1>EARTHQUAKES</Variable_Level_1>
    </Science_Keywords>
    <ISO_Topic_Category>GEOSCIENTIFIC INFORMATION</ISO_Topic_Category>
    <Platform>
        <Type>Earth Observation Satellites</Type>
        <Short_Name>SPOT-4</Short_Name>
        <Long_Name>Systeme Observation de la Terre-4</Long_Name>
        <Instrument>
            <Short_Name>SEISMIC REFLECTION PROFILERS</Short_Name>
        </Instrument>
        <Instrument>
            <Short_Name>GEOPHONES</Short_Name>
            <Long_Name>Geophone Array</Long_Name>
        </Instrument>
    </Platform>
    <Platform>
        <Type>Aircraft</Type>
        <Short_Name>NASA S-3B VIKING</Short_Name>
        <Instrument>
            <Short_Name>TSX-1</Short_Name>
            <Long_Name>Synthetic Aperture Radar</Long_Name>
        </Instrument>
    </Platform>
    <Temporal_Coverage>
        <Paleo_DateTime>
            <Chronostratigraphic_Unit>
                <Eon>PHANEROZOIC</Eon>
                <Era>CENOZOIC</Era>
                <Period>QUATERNARY</Period>
                <Epoch>HOLOCENE</Epoch>
            </Chronostratigraphic_Unit>
        </Paleo_DateTime>
        <Temporal_Info>Regression Temporal Info</Temporal_Info>
    </Temporal_Coverage>
    <Data_Resolution>
        <Horizontal_Resolution_Range>10 meters</Horizontal_Resolution_Range>
        <Vertical_Resolution_Range>5 meters</Vertical_Resolution_Range>
    </Data_Resolution>
    <Location>
        <Location_Category>CONTINENT</Location_Category>
        <Location_Type>ANTARCTICA</Location_Type>
        <Detailed_Location>MCMURDO SOUND</Detailed_Location>
    </Location>
    <Location>
        <Location_Category>GEOGRAPHIC REGION</Location_Category>
        <Location_Type>POLAR</Location_Type>
    </Location>
    <Project>
        <Short_Name>ALIENS</Short_Name>
        <Long_Name>Aliens in Antarctica</Long_Name>
    </Project>
    <Project>
        <Short_Name>ICEBRIDGE</Short_Name>
        <Long_Name>IceBridge Mission</Long_Name>
    </Project>
    <Quality>
        Regression quality narrative that should remain untouched.
    </Quality>
    <Dataset_Language>English</Dataset_Language>
    <Organization>
        <Organization_Type>ARCHIVER</Organization_Type>
        <Organization_Name>
            <Short_Name>NZ/NZAI/ANZ</Short_Name>
            <Long_Name>Antarctica New Zealand</Long_Name>
        </Organization_Name>
        <Organization_URL>http://example.org/archive</Organization_URL>
        <Personnel>
            <Role>DATA CENTER CONTACT</Role>
            <Contact_Person>
                <First_Name>SHULAMIT</First_Name>
                <Last_Name>GORDON</Last_Name>
                <Email>s.gordon@example.org</Email>
            </Contact_Person>
        </Personnel>
    </Organization>
    <Summary>
        <Abstract>Preservation abstract text that should survive all corrections.</Abstract>
    </Summary>
    <Related_URL>
        <URL_Content_Type>
            <Type>VIEW RELATED INFORMATION</Type>
            <Subtype>OpenSearch</Subtype>
        </URL_Content_Type>
        <URL>https://example.org/opensearch</URL>
        <Description>OpenSearch endpoint</Description>
    </Related_URL>
    <IDN_Node>
        <Short_Name>AMD/NZ</Short_Name>
    </IDN_Node>
    <IDN_Node>
        <Short_Name>CEOS</Short_Name>
    </IDN_Node>
    <Metadata_Dates>
        <Metadata_Creation>2009-03-03</Metadata_Creation>
        <Metadata_Last_Revision>2017-04-20</Metadata_Last_Revision>
    </Metadata_Dates>
    <Additional_Attributes>
        <Name>metadata.keyword_version</Name>
        <DataType>FLOAT</DataType>
        <Description>Not provided</Description>
        <Value>8.1</Value>
    </Additional_Attributes>
    <Product_Level_Id>NA</Product_Level_Id>
</DIF>`

const parseXml = (xml) => new DOMParser().parseFromString(xml, 'text/xml')
const normalizeXmlText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const selectText = (document, expression) => {
  const node = xpath.select1(expression, document)

  return normalizeXmlText(node?.textContent)
}

const selectTexts = (document, expression) => xpath.select(expression, document)
  .map((node) => normalizeXmlText(node.textContent))

describe('when applying DIF10 metadata corrections', () => {
  test('should return early if metadataPayload is missing', async () => {
    const result = await applyDif10MetadataCorrections({ metadataPayload: null })
    expect(result.correctionCount).toBe(0)
    expect(result.stubbed).toBe(true)
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
          Category: '',
          Class: 'In Situ Land-based Platforms',
          Type: '',
          ShortName: 'GROUND STATIONS'
        },
        newKeywordObject: {
          Category: '',
          Class: 'Space-based Platforms',
          Type: 'Earth Observation Satellites',
          ShortName: 'C-130'
        }
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

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
    // Metadata should remain unchanged (save for standard formatting)
    expect(result.correctedMetadata).toContain('<Term>AEROSOLS</Term>')
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

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
    expect(result.correctedMetadata).toContain('<Term>AEROSOLS</Term>')
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

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).not.toContain('<Location_Category>GEOGRAPHIC REGION</Location_Category>')
    expect(result.correctedMetadata).not.toContain('<Location>')
  })

  test('should verify XML declaration and formatting', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10,
      corrections: []
    })

    expect(result.correctedMetadata).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(result.correctedMetadata).toContain('<DIF>')
  })
})

describe('when correcting a DIF10 record', () => {
  test('should return a corrected DIF10', async () => {
    const mockDIF10Xml = readFileSync(
      join(__dirname, '../__mocks__/dif10.xml'),
      'utf-8'
    )

    const corrections = [
      {
        scheme: 'chronounits',
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
      },
      {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: {
          Category: '',
          Class: 'Space-based Platforms',
          Type: 'Earth Observation Satellites',
          ShortName: 'SPOT-4'
        },
        newKeywordObject: {
          Category: '',
          Class: 'Space-based Platforms',
          Type: 'Earth Observation Satellites',
          ShortName: 'SPOT-4-UPDATED'
        },
        newLongName: 'Systeme Observation de la Terre-4 Updated'
      },
      {
        scheme: 'instruments',
        action: 'replace',
        oldKeywordObject: {
          Category: 'Imaging Spectrometers/Radiometers',
          Class: '',
          Subclass: '',
          ShortName: 'GEOPHONES'
        },
        newKeywordObject: {
          Category: 'Imaging Spectrometers/Radiometers',
          Class: '',
          Subclass: '',
          ShortName: 'GEOPHONES-UPDATED'
        },
        newLongName: 'Updated Geophone Array'
      },
      {
        scheme: 'locations',
        action: 'replace',
        oldKeywordObject: {
          Category: 'CONTINENT',
          Type: 'ANTARCTICA',
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
      },
      {
        scheme: 'projects',
        oldKeywordObject: {
          Category: 'A - C',
          ShortName: 'ALIENS'
        },
        newKeywordObject: {
          Category: 'A - C',
          ShortName: 'ALIENS-UPDATED'
        },
        newLongName: 'Aliens in Antarctica Updated'
      },
      {
        scheme: 'providers',
        action: 'replace',
        oldKeywordObject: {
          BucketLevel0: 'ARCHIVER',
          BucketLevel1: '',
          BucketLevel2: '',
          BucketLevel3: '',
          ShortName: 'NZ/NZAI/ANZ'
        },
        newKeywordObject: {
          BucketLevel0: 'ARCHIVER',
          BucketLevel1: '',
          BucketLevel2: '',
          BucketLevel3: '',
          ShortName: 'NZ/NZAI/ANZ-UPDATED'
        },
        newLongName: 'Antarctica New Zealand Updated'
      },
      {
        scheme: 'rucontenttype',
        action: 'replace',
        oldKeywordObject: {
          URLContentType: 'DistributionURL',
          Type: 'VIEW RELATED INFORMATION',
          Subtype: 'OpenSearch'
        },
        newKeywordObject: {
          URLContentType: 'DistributionURL',
          Type: 'VIEW RELATED INFORMATION',
          Subtype: 'OGC WMS'
        }
      },
      {
        scheme: 'sciencekeywords',
        action: 'replace',
        oldKeywordObject: {
          Category: 'EARTH SCIENCE',
          Topic: 'OCEANS',
          Term: 'MARINE SEDIMENTS',
          VariableLevel1: 'SEDIMENTARY STRUCTURES',
          VariableLevel2: '',
          VariableLevel3: '',
          DetailedVariable: ''
        },
        newKeywordObject: {
          Category: 'EARTH SCIENCE',
          Topic: 'OCEANS',
          Term: 'MARINE SEDIMENTS',
          VariableLevel1: 'SEDIMENT TRANSPORT',
          VariableLevel2: '',
          VariableLevel3: '',
          DetailedVariable: ''
        }
      },
      {
        scheme: 'ProductLevelId',
        action: 'replace',
        oldKeywordObject: {
          Value: 'NA'
        },
        newKeywordObject: {
          Value: '1A'
        }
      }
    ]

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDIF10Xml,
      corrections
    })

    // 1. Assert expected overall modification telemetry
    expect(result.correctionCount).toBe(9)
    expect(result.stubbed).toBe(false)

    // 2. Assert exact extraction sequence of applied schemes
    const appliedSchemes = result.correctionsApplied.map((c) => c.scheme)
    expect(appliedSchemes).toEqual([
      'chronounits',
      'platforms',
      'instruments',
      'locations',
      'projects',
      'providers',
      'rucontenttype',
      'sciencekeywords',
      'ProductLevelId'
    ])

    // 3. Concrete XML assertions for each structural modification family
    const xml = result.correctedMetadata

    // ChronoUnits verification
    expect(xml).toContain('<Epoch>PLEISTOCENE</Epoch>')
    expect(xml).not.toContain('<Epoch>HOLOCENE</Epoch>')

    // Platforms verification
    expect(xml).toContain('<Short_Name>SPOT-4-UPDATED</Short_Name>')
    expect(xml).toContain('<Long_Name>Systeme Observation de la Terre-4 Updated</Long_Name>')

    // Instruments verification
    expect(xml).toContain('<Short_Name>GEOPHONES-UPDATED</Short_Name>')
    expect(xml).toContain('<Long_Name>Updated Geophone Array</Long_Name>')

    // Locations verification
    expect(xml).toContain('<Location_Type>SOUTH AMERICA</Location_Type>')
    const antarcticaMatches = xml.match(/<Location_Type>ANTARCTICA<\/Location_Type>/g) || []
    expect(antarcticaMatches).toHaveLength(2)

    // Projects verification
    expect(xml).toContain('<Short_Name>ALIENS-UPDATED</Short_Name>')
    expect(xml).toContain('<Long_Name>Aliens in Antarctica Updated</Long_Name>')

    // Providers verification
    expect(xml).toContain('<Short_Name>NZ/NZAI/ANZ-UPDATED</Short_Name>')
    expect(xml).toContain('<Long_Name>Antarctica New Zealand Updated</Long_Name>')

    // RUContentType verification
    expect(xml).toContain('<Subtype>OGC WMS</Subtype>')
    expect(xml).not.toContain('<Subtype>OpenSearch</Subtype>')

    // ScienceKeywords verification
    expect(xml).toContain('<Variable_Level_1>SEDIMENT TRANSPORT</Variable_Level_1>')
    expect(xml).not.toContain('SEDIMENTARY STRUCTURES')

    // ProductLevelId verification
    expect(xml).toContain('<Product_Level_Id>1A</Product_Level_Id>')
    expect(xml).not.toContain('<Product_Level_Id>NA</Product_Level_Id>')
  })
})

describe('when verifying DIF10 corrections do not remove unrelated metadata', () => {
  test('should preserve unrelated metadata while applying broad updates and deletes across supported fields', async () => {
    const originalDocument = parseXml(mockDif10ForMetadataPreservation)
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10ForMetadataPreservation,
      corrections: [
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
          scheme: 'locations',
          action: 'delete',
          oldKeywordObject: {
            Category: 'CONTINENT',
            Type: 'ANTARCTICA',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: 'MCMURDO SOUND'
          }
        },
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
        },
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-4'
          },
          newKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-4-UPDATED'
          },
          newLongName: 'Systeme Observation de la Terre-4 Updated'
        },
        {
          scheme: 'instruments',
          action: 'delete',
          oldKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'GEOPHONES'
          }
        },
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            Category: 'A - C',
            ShortName: 'ALIENS'
          },
          newKeywordObject: {
            Category: 'A - C',
            ShortName: 'ALIENS-UPDATED'
          },
          newLongName: 'Aliens in Antarctica Updated'
        },
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            BucketLevel0: 'ARCHIVER',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NZ/NZAI/ANZ'
          },
          newKeywordObject: {
            BucketLevel0: 'ARCHIVER',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NZ/NZAI/ANZ-UPDATED'
          },
          newLongName: 'Antarctica New Zealand Updated'
        },
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'OpenSearch'
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: 'OGC WMS'
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
          scheme: 'verticalresolutionrange',
          action: 'replace',
          oldKeywordObject: {
            Value: '5 meters'
          },
          newKeywordObject: {
            Value: '50 meters'
          }
        },
        {
          scheme: 'horizontalresolutionrange',
          action: 'replace',
          oldKeywordObject: {
            Value: '10 meters'
          },
          newKeywordObject: {
            Value: '100 meters'
          }
        },
        {
          scheme: 'productlevelid',
          action: 'replace',
          oldKeywordObject: {
            Value: 'NA'
          },
          newKeywordObject: {
            Value: '1A'
          }
        }
      ]
    })

    const updatedDocument = parseXml(result.correctedMetadata)

    expect(result.correctionCount).toBe(13)

    expect(selectTexts(updatedDocument, '//Science_Keywords/Topic')).toContain('OCEANS')
    expect(selectTexts(updatedDocument, '//Science_Keywords/Term')).toContain('MARINE SEDIMENTS')
    expect(selectTexts(updatedDocument, '//Location/Detailed_Location')).not.toContain('MCMURDO SOUND')
    expect(selectTexts(updatedDocument, '//Location/Location_Type')).toContain('POLAR')
    expect(selectText(updatedDocument, '//Chronostratigraphic_Unit/Epoch')).toBe('PLEISTOCENE')
    expect(selectTexts(updatedDocument, '//Platform/Short_Name')).toContain('SPOT-4-UPDATED')
    expect(selectText(updatedDocument, '//Platform[Short_Name="SPOT-4-UPDATED"]/Long_Name')).toBe('Systeme Observation de la Terre-4 Updated')
    expect(selectTexts(updatedDocument, '//Platform[Short_Name="SPOT-4-UPDATED"]/Instrument/Short_Name')).not.toContain('GEOPHONES')
    expect(selectTexts(updatedDocument, '//Platform[Short_Name="SPOT-4-UPDATED"]/Instrument/Short_Name')).toContain('SEISMIC REFLECTION PROFILERS')
    expect(selectTexts(updatedDocument, '//Project/Short_Name')).toContain('ALIENS-UPDATED')
    expect(selectTexts(updatedDocument, '//Project/Short_Name')).toContain('ICEBRIDGE')
    expect(selectText(updatedDocument, '//Organization/Organization_Name/Short_Name')).toBe('NZ/NZAI/ANZ-UPDATED')
    expect(selectText(updatedDocument, '//Organization/Organization_Name/Long_Name')).toBe('Antarctica New Zealand Updated')
    expect(selectText(updatedDocument, '//Related_URL/URL_Content_Type/Subtype')).toBe('OGC WMS')
    expect(selectTexts(updatedDocument, '//IDN_Node/Short_Name')).toContain('AMD/NZ')
    expect(selectTexts(updatedDocument, '//IDN_Node/Short_Name')).not.toContain('CEOS')
    expect(selectText(updatedDocument, '//ISO_Topic_Category')).toBe('OCEANS')
    expect(selectText(updatedDocument, '//Data_Resolution/Vertical_Resolution_Range')).toBe('50 meters')
    expect(selectText(updatedDocument, '//Data_Resolution/Horizontal_Resolution_Range')).toBe('100 meters')
    expect(selectText(updatedDocument, '//Product_Level_Id')).toBe('1A')

    const preservedTextExpressions = [
      '//Entry_Title',
      '//Personnel[Role="INVESTIGATOR"]/Contact_Person/Email',
      '//Temporal_Coverage/Temporal_Info',
      '//Summary/Abstract',
      '//Quality',
      '//Dataset_Language',
      '//Organization/Organization_URL',
      '//Organization/Personnel/Contact_Person/Email',
      '//Related_URL/URL',
      '//Related_URL/Description',
      '//Metadata_Dates/Metadata_Last_Revision',
      '//Additional_Attributes[Name="metadata.keyword_version"]/Value'
    ]

    preservedTextExpressions.forEach((expression) => {
      expect(selectText(updatedDocument, expression)).toBe(selectText(originalDocument, expression))
    })

    expect(selectTexts(updatedDocument, '//Platform/Short_Name')).toContain('NASA S-3B VIKING')
    expect(selectText(updatedDocument, '//Platform[Short_Name="NASA S-3B VIKING"]/Instrument/Short_Name')).toBe('TSX-1')
    expect(selectTexts(updatedDocument, '//Science_Keywords/Topic')).toContain('SOLID EARTH')
    expect(selectTexts(updatedDocument, '//Science_Keywords/Variable_Level_1')).toContain('EARTHQUAKES')
  })
})

const mockDif10WithChronounits = `<DIF>
    <Entry_ID>
        <Short_Name>CHRONO_TEST</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Chronostratigraphic Units</Entry_Title>
    <Temporal_Coverage>
        <Paleo_DateTime>
            <Paleo_Start_Date>1970-01-01</Paleo_Start_Date>
            <Paleo_Stop_Date>2000-01-01</Paleo_Stop_Date>
            <Chronostratigraphic_Unit>
                <Eon>PHANEROZOIC</Eon>
                <Era>CENOZOIC</Era>
                <Period>QUATERNARY</Period>
                <Epoch>HOLOCENE</Epoch>
            </Chronostratigraphic_Unit>
            <Chronostratigraphic_Unit>
                <Eon>PHANEROZOIC</Eon>
                <Era>MESOZOIC</Era>
                <Period>CRETACEOUS</Period>
            </Chronostratigraphic_Unit>
        </Paleo_DateTime>
    </Temporal_Coverage>
</DIF>`

describe('when applying chronounits DIF10 corrections', () => {
  test('should apply chronostratigraphic unit correction', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
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
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the epoch was updated
    expect(result.correctedMetadata).toContain('<Epoch>PLEISTOCENE</Epoch>')
    expect(result.correctedMetadata).not.toContain('<Epoch>HOLOCENE</Epoch>')

    // Other fields should remain
    expect(result.correctedMetadata).toContain('<Eon>PHANEROZOIC</Eon>')
    expect(result.correctedMetadata).toContain('<Era>CENOZOIC</Era>')
    expect(result.correctedMetadata).toContain('<Period>QUATERNARY</Period>')
  })

  test('should update entire chronostratigraphic hierarchy', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 1],
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

    // Verify the second unit was completely updated
    expect(result.correctedMetadata).toContain('<Era>PALEOZOIC</Era>')
    expect(result.correctedMetadata).toContain('<Period>PERMIAN</Period>')
    expect(result.correctedMetadata).toContain('<Epoch>LOPINGIAN</Epoch>')

    // Old values should be gone
    expect(result.correctedMetadata).not.toContain('MESOZOIC')
    expect(result.correctedMetadata).not.toContain('CRETACEOUS')
  })

  test('should add stage and detailed classification levels', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
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

    expect(result.correctedMetadata).toContain('<Epoch>HOLOCENE</Epoch>')
    expect(result.correctedMetadata).toContain('<Stage>GREENLANDIAN</Stage>')
    expect(result.correctedMetadata).toContain('<Detailed_Classification>EARLY HOLOCENE</Detailed_Classification>')
  })

  test('should delete chronostratigraphic unit at index', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 1],
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'MESOZOIC',
            Period: 'CRETACEOUS',
            Epoch: '',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Second unit should be removed
    expect(result.correctedMetadata).not.toContain('MESOZOIC')
    expect(result.correctedMetadata).not.toContain('CRETACEOUS')

    // First unit should remain
    expect(result.correctedMetadata).toContain('HOLOCENE')
  })

  test('should delete parent property when the last unit in an array is removed', async () => {
    const multiChronoXml = `<DIF>
    <Temporal_Coverage>
        <Paleo_DateTime>
            <Chronostratigraphic_Unit>
                <Eon>EON1</Eon>
            </Chronostratigraphic_Unit>
            <Chronostratigraphic_Unit>
                <Eon>EON2</Eon>
            </Chronostratigraphic_Unit>
        </Paleo_DateTime>
    </Temporal_Coverage>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiChronoXml,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordObject: {
            Eon: 'EON1',
            Era: '',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          }
        },
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordObject: {
            Eon: 'EON2',
            Era: '',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // The entire Chronostratigraphic_Unit tag should be removed from the XML
    expect(result.correctedMetadata).not.toContain('<Chronostratigraphic_Unit>')
    expect(result.correctedMetadata).not.toContain('</Chronostratigraphic_Unit>')
  })

  test('should handle missing Chronostratigraphic_Unit element', async () => {
    const xmlWithoutChronoUnits = `<DIF>
    <Entry_ID>
        <Short_Name>NO_CHRONO</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutChronoUnits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
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

  test('should delete single chronostratigraphic unit', async () => {
    const singleChronoUnitXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_CHRONO</Short_Name>
    </Entry_ID>
    <Temporal_Coverage>
        <Paleo_DateTime>
            <Chronostratigraphic_Unit>
                <Eon>PHANEROZOIC</Eon>
            </Chronostratigraphic_Unit>
        </Paleo_DateTime>
    </Temporal_Coverage>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleChronoUnitXml,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'delete',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: '',
            Period: '',
            Epoch: '',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // The Chronostratigraphic_Unit element should be completely removed
    expect(result.correctedMetadata).not.toContain('Chronostratigraphic_Unit')
  })
})

describe('when chronounits guard clauses prevent a correction', () => {
  test('should return false when ummPath does not contain a numeric index', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [{
        scheme: 'chronounits',
        action: 'replace',
        ummPath: ['Chronostratigraphic_Unit'], // Missing numeric index
        newKeywordObject: {
          Eon: 'EON',
          Era: 'ERA',
          Period: 'PERIOD',
          Epoch: 'EPOCH',
          Age: '',
          SubAge: ''
        }
      }]
    })

    // The delegate returns false, so the orchestrator does not increment the count
    expect(result.correctionCount).toBe(0)
  })

  test('should return false when Chronostratigraphic_Unit element is missing', async () => {
    const xmlNoChrono = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: xmlNoChrono,
      corrections: [{
        scheme: 'chronounits',
        action: 'replace',
        ummPath: ['Chronostratigraphic_Unit', 0],
        newKeywordObject: {
          Eon: 'EON',
          Era: 'ERA',
          Period: 'PERIOD',
          Epoch: 'EPOCH',
          Age: '',
          SubAge: ''
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should return false when index is out of bounds for an array', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [{
        scheme: 'chronounits',
        action: 'replace',
        ummPath: ['Chronostratigraphic_Unit', 99], // Index out of range
        newKeywordObject: {
          Eon: 'EON',
          Era: 'ERA',
          Period: 'PERIOD',
          Epoch: 'EPOCH',
          Age: '',
          SubAge: ''
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should return false for unsupported action (final fall-through)', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [{
        scheme: 'chronounits',
        action: 'unsupported_action', // Triggers the final return false in the delegate logic
        ummPath: ['Chronostratigraphic_Unit', 0]
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should handle chronounits where leaves are parsed as objects with a #text property', async () => {
    // Injecting an attribute into <Eon> to force fast-xml-parser to create an object instead of a string
    const complexChronoXml = `<DIF>
      <Temporal_Coverage>
          <Paleo_DateTime>
              <Chronostratigraphic_Unit>
                  <Eon xml:lang="en">PHANEROZOIC</Eon>
                  <Era>CENOZOIC</Era>
                  <Period>QUATERNARY</Period>
              </Chronostratigraphic_Unit>
          </Paleo_DateTime>
      </Temporal_Coverage>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: complexChronoXml,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'replace',
          ummPath: ['Chronostratigraphic_Unit', 0],
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'QUATERNARY',
            Epoch: '',
            Age: '',
            SubAge: ''
          },
          newKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'NEOGENE',
            Epoch: '',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify line 23 fallback cleanly extracted values and updated successfully
    expect(result.correctedMetadata).toContain('<Period>NEOGENE</Period>')
    expect(result.correctedMetadata).not.toContain('QUATERNARY')
  })

  test('should return false for unsupported action type using value-based lookup (final fall-through)', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithChronounits,
      corrections: [
        {
          scheme: 'chronounits',
          action: 'unsupported_action_type', // Neither 'replace' nor 'delete'
          oldKeywordObject: {
            Eon: 'PHANEROZOIC',
            Era: 'CENOZOIC',
            Period: 'QUATERNARY',
            Epoch: 'HOLOCENE',
            Age: '',
            SubAge: ''
          }
        }
      ]
    })

    // Line 113 triggers: correctionCount does not increment because the delegate returns false
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })
})

const mockDif10WithResolution = `<DIF>
    <Data_Resolution>
        <Horizontal_Resolution_Range>0 - 1 meter</Horizontal_Resolution_Range>
        <Horizontal_Resolution_Range>1 - 10 meters</Horizontal_Resolution_Range>
    </Data_Resolution>
</DIF>`

describe('when applying horizontal resolution DIF10 corrections', () => {
  describe('when replacing values', () => {
    test('should replace a specific range in an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithResolution,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'replace',
          ummPath: ['HorizontalResolutionRanges', 1],
          oldKeywordObject: {
            Value: '1 - 10 meters'
          },
          newKeywordObject: {
            Value: 'Updated Range'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>Updated Range</Horizontal_Resolution_Range>')
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>0 - 1 meter</Horizontal_Resolution_Range>')
    })

    test('should replace a single range value when it is not in an array', async () => {
      const singleXml = '<DIF><Data_Resolution><Horizontal_Resolution_Range>Old</Horizontal_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'replace',
          ummPath: ['HorizontalResolutionRanges', 0],
          oldKeywordObject: {
            Value: 'Old'
          },
          newKeywordObject: {
            Value: 'New'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>New</Horizontal_Resolution_Range>')
    })
  })

  describe('when deleting values and cleaning up empty containers', () => {
    test('should delete a range from an array and keep the parent when it is not empty', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithResolution,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'delete',
          ummPath: ['HorizontalResolutionRanges', 0],
          oldKeywordObject: {
            Value: '0 - 1 meter'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('0 - 1 meter')
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
    })

    test('should remove only the field when the last range is removed (preserving parent)', async () => {
      const xmlWithSiblings = `<DIF>
        <Data_Resolution>
            <Horizontal_Resolution_Range>1 - 10 meters</Horizontal_Resolution_Range>
            <Vertical_Resolution_Range>5 meters</Vertical_Resolution_Range>
        </Data_Resolution>
    </DIF>`

      const result = await applyDif10MetadataCorrections({
        metadataPayload: xmlWithSiblings,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'delete',
          oldKeywordObject: {
            Value: '1 - 10 meters'
          },
          newKeywordObject: {}
        }]
      })

      expect(result.correctedMetadata).not.toContain('<Horizontal_Resolution_Range>')
      // Verify the parent and siblings still exist
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('<Vertical_Resolution_Range>5 meters</Vertical_Resolution_Range>')
    })

    test('should delete the Data_Resolution parent when the last horizontal range is removed', async () => {
      const singleXml = '<DIF><Data_Resolution><Horizontal_Resolution_Range>Only Range</Horizontal_Resolution_Range></Data_Resolution></DIF>'

      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'delete',
          oldKeywordObject: {
            Value: 'Only Range'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<Horizontal_Resolution_Range>')
      expect(result.correctedMetadata).not.toContain('<Data_Resolution>')
    })

    test('should delete the target field when the last element of an array is removed', async () => {
      // Starting with two elements
      const twoElementsXml = `<DIF>
        <Data_Resolution>
            <Horizontal_Resolution_Range>Range 1</Horizontal_Resolution_Range>
            <Horizontal_Resolution_Range>Range 2</Horizontal_Resolution_Range>
            <Temporal_Resolution_Range>Other Field</Temporal_Resolution_Range>
        </Data_Resolution>
      </DIF>`

      const result = await applyDif10MetadataCorrections({
        metadataPayload: twoElementsXml,
        corrections: [
          {
            scheme: 'horizontalresolutionrange',
            action: 'delete',
            ummPath: ['HorizontalResolutionRanges', 0],
            oldKeywordObject: {
              Value: 'Range 1'
            }
          },
          {
            scheme: 'horizontalresolutionrange',
            action: 'delete',
            ummPath: ['HorizontalResolutionRanges', 0],
            oldKeywordObject: {
              Value: 'Range 2'
            }
          }
        ]
      })

      expect(result.correctionCount).toBe(2)
      // Horizontal_Resolution_Range should be gone
      expect(result.correctedMetadata).not.toContain('<Horizontal_Resolution_Range>')
      // Data_Resolution should still exist because Temporal_Resolution_Range remains
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('<Temporal_Resolution_Range>Other Field</Temporal_Resolution_Range>')
    })
  })

  describe('when guard clauses prevent a correction', () => {
    test('should return false if Data_Resolution is missing from metadata', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          ummPath: ['HorizontalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false when an unsupported action is provided', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithResolution,
        corrections: [{
          scheme: 'horizontalresolutionrange',
          action: 'invalid_action_name', // This bypasses both 'delete' and 'replace' blocks
          oldKeywordObject: {
            Value: '0 - 1 meter'
          },
          newKeywordObject: {
            Value: 'New Value'
          }
        }]
      })

      // The function reaches the final 'return false', resulting in 0 corrections
      expect(result.correctionCount).toBe(0)
      expect(result.correctionsApplied).toHaveLength(0)
    })
  })
})

const mockDif10WithIdnNodes = `<DIF>
    <Entry_ID>
        <Short_Name>IDN_NODE_TEST</Short_Name>
    </Entry_ID>
    <IDN_Node>
      <Short_Name>ARCTIC</Short_Name>
      <Long_Name>Arctic Council</Long_Name>
    </IDN_Node>
    <IDN_Node>
      <Short_Name>USA/NASA</Short_Name>
      <Long_Name>National Aeronautics and Space Administration</Long_Name>
    </IDN_Node>
</DIF>`

describe('when applying idnnode DIF10 corrections', () => {
  test('should apply a replace correction using a single path segment as Short_Name', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'replace',
          oldKeywordObject: {
            ShortName: 'ARCTIC'
          },
          newKeywordObject: {
            ShortName: 'NEW-ARCTIC'
          }, // The Short_Name
          newLongName: 'Updated Arctic Council' // The Long_Name
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>NEW-ARCTIC</Short_Name>')
    expect(result.correctedMetadata).toContain('<Long_Name>Updated Arctic Council</Long_Name>')
    // Verify second node remains untouched so we know only the matched node changed
    expect(result.correctedMetadata).toContain('<Short_Name>USA/NASA</Short_Name>')
  })

  test('should cover field pruning by deleting Long_Name if newLongName is empty', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
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
          newLongName: '' // Triggers the delete branch for Long_Name
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>NASA-UPDATED</Short_Name>')
    // Long_Name tag should be removed for the second node
    expect(result.correctedMetadata).not.toContain('National Aeronautics and Space Administration')
    // First node Long_Name remains
    expect(result.correctedMetadata).toContain('<Long_Name>Arctic Council</Long_Name>')
  })

  test('should delete a specific IDN_Node from an array', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
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
    expect(result.correctedMetadata).not.toContain('<Short_Name>ARCTIC</Short_Name>')
    expect(result.correctedMetadata).toContain('<Short_Name>USA/NASA</Short_Name>')
  })

  test('should delete parent IDN_Node property when the last node is removed', async () => {
    const singleNodeXml = '<DIF><IDN_Node><Short_Name>ONLY-ONE</Short_Name></IDN_Node></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleNodeXml,
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
    // The entire IDN_Node element should be gone
    expect(result.correctedMetadata).not.toContain('<IDN_Node>')
  })

  test('should delete the IDN_Node key when the last element of an array is removed', async () => {
    // Starting with an array of two nodes
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithIdnNodes,
      corrections: [
        {
          scheme: 'idnnode',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'ARCTIC'
          }
        },
        {
          scheme: 'idnnode',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'USA/NASA'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // This triggers: if (parent.IDN_Node.length === 0) { delete parent.IDN_Node }
    expect(result.correctedMetadata).not.toContain('<IDN_Node>')
  })

  describe('when guard clauses prevent a correction', () => {
    test('should return false when oldKeywordObject is missing', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithIdnNodes,
        corrections: [{
          scheme: 'idnnode',
          action: 'replace',
          newKeywordObject: {
            ShortName: 'A > B'
          }
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false when IDN_Node element is missing from metadata', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'idnnode',
          action: 'replace',
          newKeywordObject: {
            ShortName: 'A > B'
          }
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false for unrecognized action (fall-through)', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithIdnNodes,
        corrections: [{
          scheme: 'idnnode',
          action: 'invalid_action'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should handle idnnode delete single object vs array', async () => {
    // Test the "else" branch of the delete logic (single object)
      const singleNodeXml = '<DIF><IDN_Node><Short_Name>ONLY</Short_Name></IDN_Node></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleNodeXml,
        corrections: [{
          scheme: 'idnnode',
          action: 'delete',
          oldKeywordObject: {
            ShortName: 'ONLY'
          }
        }]
      })
      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<IDN_Node>')
    })
  })
})

const mockDif10WithInstruments = `<DIF>
    <Entry_ID>
        <Short_Name>Instruments_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Instruments</Entry_Title>
    <Platform>
      <Type>Air-based Platforms</Type>
      <Short_Name>UC-12B</Short_Name>
      <Long_Name>NASA Langley Beechcraft UC-12B Huron</Long_Name>
      <Instrument>
        <Short_Name>IRMSS</Short_Name>
        <Long_Name>Infrared Multispectral Scanner</Long_Name>
      </Instrument>
    </Platform>
    <Platform>
      <Type>Land-based Platforms</Type>
      <Short_Name>MINTS</Short_Name>
      <Long_Name>Multi-Scale Integrated Intelligent Interactive Sensing Consortium</Long_Name>
      <Instrument>
        <Short_Name>LISS-II</Short_Name>
        <Long_Name>Linear Imaging Self Scanning Sensor II</Long_Name>
      </Instrument>
    </Platform>
</DIF>`

describe('when applying instrument DIF10 corrections', () => {
  test('should apply long name correction to first Instrument', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'IRMSS'
          },
          newKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'IRMSS'
          },
          newLongName: 'Updated Infrared Multispectral Scanner'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Updated Infrared Multispectral Scanner</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Infrared Multispectral Scanner</Long_Name>')

    // Other long name should remain unchanged
    expect(result.correctedMetadata).toContain('<Long_Name>Linear Imaging Self Scanning Sensor II</Long_Name>')

    // Platform stays untouched
    expect(result.correctedMetadata).toContain('<Short_Name>UC-12B</Short_Name>')
  })

  test('should update both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          oldKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'LISS-II'
          },
          newKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'LISSUPDATE-II'
          },
          newLongName: 'Linear Imaging Self Scanning Sensor II Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>LISSUPDATE-II</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>LISS-II</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Linear Imaging Self Scanning Sensor II Updated</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Linear Imaging Self Scanning Sensor II</Long_Name>')
  })

  test('should delete Instrument', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'delete',
          oldKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'IRMSS'
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Instrument should be removed
    expect(result.correctedMetadata).not.toContain('<Short_Name>IRMSS</Short_Name>')

    // Other Instrument should be unchanged
    expect(result.correctedMetadata).toContain('<Short_Name>LISS-II</Short_Name>')
  })

  test('should delete parent Instrument property when the last instrument in an array is removed', async () => {
    const multiInstrumentXml = `<DIF>
      <Platform>
        <Short_Name>P1</Short_Name>
        <Instrument><Short_Name>I1</Short_Name></Instrument>
        <Instrument><Short_Name>I2</Short_Name></Instrument>
      </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiInstrumentXml,
      corrections: [
        {
          scheme: 'instruments',
          action: 'delete',
          oldKeywordObject: {
            Category: 'Instrument',
            Class: '',
            Subclass: '',
            ShortName: 'I1'
          }
        },
        {
          scheme: 'instruments',
          action: 'delete',
          oldKeywordObject: {
            Category: 'Instrument',
            Class: '',
            Subclass: '',
            ShortName: 'I2'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // The Instrument tag should be entirely removed from the XML
    expect(result.correctedMetadata).not.toContain('<Instrument>')
  })

  test('should cover the else branch by deleting a single instrument object', async () => {
    const singleInstrumentXml = `<DIF>
      <Platform>
        <Short_Name>P1</Short_Name>
        <Instrument><Short_Name>I1</Short_Name></Instrument>
      </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleInstrumentXml,
      corrections: [
        {
          scheme: 'instruments',
          action: 'delete',
          oldKeywordObject: {
            Category: 'Instrument',
            Class: '',
            Subclass: '',
            ShortName: 'I1'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).not.toContain('<Instrument>')
  })

  test('should cover the field pruning else branch by providing an empty long name', async () => {
    const instrumentXml = `<DIF>
      <Platform>
        <Short_Name>P1</Short_Name>
        <Instrument>
          <Short_Name>OLD-SHORT</Short_Name>
          <Long_Name>Old Long Name to delete</Long_Name>
        </Instrument>
      </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: instrumentXml,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            Category: 'Instrument',
            Class: '',
            Subclass: '',
            ShortName: 'OLD-SHORT'
          },
          newKeywordObject: {
            Category: 'Category',
            Class: 'Topic',
            Subclass: 'Term',
            ShortName: 'NEW-SHORT'
          },
          newLongName: '' // Triggers delete target['Long_Name']
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>NEW-SHORT</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>')
  })

  test('should handle missing Instrument element', async () => {
    const xmlWithoutPlatform = `<DIF>
        <Entry_ID>
            <Short_Name>No_instrument</Short_Name>
        </Entry_ID>
        <Platform>
          <Type>Air-based Platforms</Type>
          <Short_Name>UC-12B</Short_Name>
          <Long_Name>NASA Langley Beechcraft UC-12B Huron</Long_Name>
        </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutPlatform,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          oldKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'IRMSS'
          },
          newKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'IRMSS1'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should match by old keyword path even when a stale ummPath is present', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithInstruments,
      corrections: [
        {
          scheme: 'instruments',
          action: 'replace',
          ummPath: ['Platform', 10, 'Instrument', 0],
          oldKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'IRMSS'
          },
          newKeywordObject: {
            Category: 'Imaging Spectrometers/Radiometers',
            Class: '',
            Subclass: '',
            ShortName: 'IRMSS1'
          },
          newLongName: 'Infrared Multispectral Scanner Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>IRMSS1</Short_Name>')
  })
})

describe('when instrument guard clauses prevent a correction', () => {
  test('should return false when oldKeywordObject is missing', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'replace',
        newKeywordObject: {
          Category: 'Category',
          Class: 'Topic',
          Subclass: 'Term',
          ShortName: 'NEW-SHORT'
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should return false when Platform or Instrument element is missing from metadata', async () => {
    const xmlNoInstruments = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: xmlNoInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'replace',
        newKeywordObject: {
          Category: 'Category',
          Class: 'Topic',
          Subclass: 'Term',
          ShortName: 'NEW-SHORT'
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should return false when the current instrument path cannot be matched', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'replace',
        oldKeywordObject: {
          Category: 'Imaging Spectrometers/Radiometers',
          Class: '',
          Subclass: '',
          ShortName: 'NOT-REAL'
        },
        newKeywordObject: {
          Category: 'Category',
          Class: 'Topic',
          Subclass: 'Term',
          ShortName: 'NEW-SHORT'
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should return false for unsupported action (final fall-through)', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'invalid_action_type'
      }]
    })

    expect(result.correctionCount).toBe(0)
  })
})

const mockDif10WithCategories = `<DIF>
    <ISO_Topic_Category>BIOTA</ISO_Topic_Category>
    <ISO_Topic_Category>CLIMATOLOGY/METEOROLOGY/ATMOSPHERE</ISO_Topic_Category>
</DIF>`

describe('when applying ISO topic category DIF10 corrections', () => {
  describe('when replacing values', () => {
    test('should replace a specific category in an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          oldKeywordObject: {
            Value: 'CLIMATOLOGY/METEOROLOGY/ATMOSPHERE'
          },
          newKeywordObject: {
            Value: 'FARMING'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>FARMING</ISO_Topic_Category>')
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>BIOTA</ISO_Topic_Category>')
      expect(result.correctedMetadata).not.toContain('CLIMATOLOGY/METEOROLOGY/ATMOSPHERE')
    })

    test('should replace a single category value when it is not in an array', async () => {
      const singleXml = '<DIF><ISO_Topic_Category>OLD_CAT</ISO_Topic_Category></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          oldKeywordObject: {
            Value: 'OLD_CAT'
          },
          newKeywordObject: {
            Value: 'NEW_CAT'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>NEW_CAT</ISO_Topic_Category>')
    })
  })

  describe('when deleting values', () => {
    test('should delete a specific category from an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'delete',
          oldKeywordObject: {
            Value: 'BIOTA'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>BIOTA</ISO_Topic_Category>')
      expect(result.correctedMetadata).toContain('<ISO_Topic_Category>CLIMATOLOGY/METEOROLOGY/ATMOSPHERE</ISO_Topic_Category>')
    })

    test('should delete the property entirely when the last item in an array is removed', async () => {
      const singleXml = '<DIF><ISO_Topic_Category>LAST_ONE</ISO_Topic_Category></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'delete',
          oldKeywordObject: {
            Value: 'LAST_ONE'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>')
    })

    test('should handle deletion of a single non-array property (else if branch)', async () => {
      const singleXml = '<DIF><ISO_Topic_Category>SINGLE_STRING</ISO_Topic_Category></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'delete',
          oldKeywordObject: {
            Value: 'SINGLE_STRING'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>')
    })

    test('should delete the ISO_Topic_Category key when an array becomes empty', async () => {
      // Starting with an array of two categories
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [
          {
            scheme: 'isotopiccategory',
            action: 'delete',
            oldKeywordObject: {
              Value: 'BIOTA'
            }
          },
          {
            scheme: 'isotopiccategory',
            action: 'delete',
            oldKeywordObject: {
              Value: 'CLIMATOLOGY/METEOROLOGY/ATMOSPHERE'
            }
          }
        ]
      })

      expect(result.correctionCount).toBe(2)
      // This specifically triggers: if (parent.ISO_Topic_Category.length === 0) { delete parent.ISO_Topic_Category }
      expect(result.correctedMetadata).not.toContain('<ISO_Topic_Category>')
    })
  })

  describe('when guard clauses prevent a correction', () => {
    test('should return false if oldKeywordObject is missing', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false if ISO_Topic_Category is missing from metadata', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false for unrecognized action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'invalid_action'
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false when the current category value cannot be matched', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithCategories,
        corrections: [{
          scheme: 'isotopiccategory',
          action: 'replace',
          oldKeywordObject: {
            Value: 'NOT_REAL'
          },
          newKeywordObject: {
            Value: 'FAIL'
          }
        }]
      })
      expect(result.correctionCount).toBe(0)
    })
  })
})

const mockDif10WithLocations = `<DIF>
    <Entry_ID>
        <Short_Name>LOCATION_TEST</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Locations</Entry_Title>
    <Location>
        <Location_Category>CONTINENT</Location_Category>
        <Location_Type>NORTH AMERICA</Location_Type>
    </Location>
    <Location>
        <Location_Category>OCEAN</Location_Category>
        <Location_Type>PACIFIC OCEAN</Location_Type>
    </Location>
    <Location>
        <Location_Category>CONTINENT</Location_Category>
        <Location_Type>NORTH AMERICA</Location_Type>
        <Location_Subregion1>UNITED STATES OF AMERICA</Location_Subregion1>
    </Location>
</DIF>`

describe('when applying location DIF10 corrections', () => {
  test('should apply location correction to first location', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 0],
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
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the first location was updated
    expect(result.correctedMetadata).toContain('<Location_Type>SOUTH AMERICA</Location_Type>')

    // Second location should remain unchanged (PACIFIC OCEAN)
    expect(result.correctedMetadata).toContain('<Location_Type>PACIFIC OCEAN</Location_Type>')

    // Third location should still have NORTH AMERICA
    const northAmericaMatches = result.correctedMetadata.match(/<Location_Type>NORTH AMERICA<\/Location_Type>/g)
    expect(northAmericaMatches).toHaveLength(1) // Only in third location now
  })

  test('should apply location correction with subregion', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 2],
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

    // Verify subregion was updated
    expect(result.correctedMetadata).toContain('<Location_Subregion1>CANADA</Location_Subregion1>')
    expect(result.correctedMetadata).not.toContain('UNITED STATES OF AMERICA')
  })

  test('should add multiple subregion levels', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 2],
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

    expect(result.correctedMetadata).toContain('<Location_Subregion1>UNITED STATES OF AMERICA</Location_Subregion1>')
    expect(result.correctedMetadata).toContain('<Location_Subregion2>CALIFORNIA</Location_Subregion2>')
    expect(result.correctedMetadata).toContain('<Location_Subregion3>LOS ANGELES</Location_Subregion3>')
  })

  test('should remove subregion levels when moving to higher level', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 2],
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

    expect(result.correctedMetadata).toContain('<Location_Type>EUROPE</Location_Type>')
    expect(result.correctedMetadata).not.toContain('UNITED STATES OF AMERICA')
  })

  test('should delete location at index', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithLocations,
      corrections: [
        {
          scheme: 'locations',
          action: 'delete',
          ummPath: ['Locations', 1],
          oldKeywordObject: {
            Category: 'OCEAN',
            Type: 'PACIFIC OCEAN',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // PACIFIC OCEAN should be removed
    expect(result.correctedMetadata).not.toContain('PACIFIC OCEAN')

    // Other locations should remain
    expect(result.correctedMetadata).toContain('NORTH AMERICA')
    expect(result.correctedMetadata).toContain('UNITED STATES OF AMERICA')
  })

  test('should trigger array pruning when the last element of an array is spliced', async () => {
    const multiLocationXml = `<DIF>
      <Location><Location_Category>A</Location_Category></Location>
      <Location><Location_Category>B</Location_Category></Location>
  </DIF>`

    // To reach the 'length === 0' line, we must delete both or
    // ensure the logic splices the last remaining item in an array.
    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiLocationXml,
      corrections: [
        {
          scheme: 'locations',
          action: 'delete',
          ummPath: ['Locations', 0],
          oldKeywordObject: {
            Category: 'A',
            Type: '',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        },
        {
          scheme: 'locations',
          action: 'delete',
          ummPath: ['Locations', 0],
          oldKeywordObject: {
            Category: 'B',
            Type: '',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    expect(result.correctedMetadata).not.toContain('<Location>')
  })

  test('should handle single location (not array)', async () => {
    const singleLocationXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_LOCATION</Short_Name>
    </Entry_ID>
    <Location>
        <Location_Category>OCEAN</Location_Category>
        <Location_Type>ATLANTIC OCEAN</Location_Type>
    </Location>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleLocationXml,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 0],
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
            Type: 'INDIAN OCEAN',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Location_Type>INDIAN OCEAN</Location_Type>')
    expect(result.correctedMetadata).not.toContain('ATLANTIC OCEAN')
  })

  test('should handle missing Location element', async () => {
    const xmlWithoutLocation = `<DIF>
    <Entry_ID>
        <Short_Name>NO_LOCATION</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutLocation,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          ummPath: ['Locations', 0],
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
    expect(result.correctionsApplied).toHaveLength(0)
  })
})

describe('when location guard clauses prevent a correction', () => {
  test('should return false when ummPath does not contain a numeric index', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithLocations,
      corrections: [{
        scheme: 'locations',
        action: 'replace',
        ummPath: ['Locations', 'first'], // String instead of Number
        newKeywordObject: {
          Category: 'CONTINENT',
          Type: 'EUROPE',
          Subregion1: '',
          Subregion2: '',
          Subregion3: '',
          DetailedLocation: ''
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should return false when index is out of bounds', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithLocations,
      corrections: [{
        scheme: 'locations',
        action: 'replace',
        ummPath: ['Locations', 99], // Index does not exist
        newKeywordObject: {
          Category: 'CONTINENT',
          Type: 'EUROPE',
          Subregion1: '',
          Subregion2: '',
          Subregion3: '',
          DetailedLocation: ''
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should return false when action is unsupported', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithLocations,
      corrections: [{
        scheme: 'locations',
        action: 'invalid_action', // Not replace or delete
        ummPath: ['Locations', 0],
        newKeywordObject: {
          Category: 'CONTINENT',
          Type: 'EUROPE',
          Subregion1: '',
          Subregion2: '',
          Subregion3: '',
          DetailedLocation: ''
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should handle locations where leaves are parsed as objects with a #text property', async () => {
    const complexLocationXml = `<DIF>
      <Location>
          <Location_Category xml:lang="en">GEOGRAPHIC REGION</Location_Category>
          <Location_Type>GLOBAL</Location_Type>
      </Location>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: complexLocationXml,
      corrections: [
        {
          scheme: 'locations',
          action: 'replace',
          oldKeywordObject: {
            Category: 'GEOGRAPHIC REGION',
            Type: 'GLOBAL',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          },
          newKeywordObject: {
            Category: 'GEOGRAPHIC REGION',
            Type: 'CONTINENT',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Location_Type>CONTINENT</Location_Type>')
  })

  test('should return false for unsupported action type using value-based lookup (final fall-through)', async () => {
    const mockLocationXml = `<DIF>
      <Location>
          <Location_Category>GEOGRAPHIC REGION</Location_Category>
          <Location_Type>GLOBAL</Location_Type>
      </Location>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockLocationXml,
      corrections: [
        {
          scheme: 'locations',
          action: 'unsupported_action_type',
          oldKeywordObject: {
            Category: 'GEOGRAPHIC REGION',
            Type: 'GLOBAL',
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

  test('should delete parent property when a single location (non-array) element is removed', async () => {
    // A single Location block (not inside an array layout)
    const singleLocationXml = `<DIF>
      <Entry_ID>
          <Short_Name>SINGLE_LOC_DELETE</Short_Name>
      </Entry_ID>
      <Location>
          <Location_Category>GEOGRAPHIC REGION</Location_Category>
          <Location_Type>GLOBAL</Location_Type>
      </Location>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleLocationXml,
      corrections: [
        {
          scheme: 'locations',
          action: 'delete',
          oldKeywordObject: {
            Category: 'GEOGRAPHIC REGION',
            Type: 'GLOBAL',
            Subregion1: '',
            Subregion2: '',
            Subregion3: '',
            DetailedLocation: ''
          }
        }
      ]
    })

    // Verify the correction was registered successfully
    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify that the entire Location property was purged from the XML structure
    expect(result.correctedMetadata).not.toContain('<Location>')
    expect(result.correctedMetadata).not.toContain('</Location>')
    expect(result.correctedMetadata).not.toContain('GEOGRAPHIC REGION')
  })
})

const mockDif10WithPlatforms = `<DIF>
    <Entry_ID>
        <Short_Name>Platforms_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Platforms</Entry_Title>
    <Platform>
      <Type>Earth Observation Satellites</Type>
      <Short_Name>SPOT-4</Short_Name>
      <Long_Name>Systeme Observation de la Terre-4</Long_Name>
      <Instrument>
        <Short_Name>VEGETATION-1</Short_Name>
        <Long_Name>VEGETATION INSTRUMENT 1 (SPOT 4)</Long_Name>
      </Instrument>
    </Platform>
    <Platform>
      <Type>Earth Observation planes</Type>
      <Short_Name>SPOT-5</Short_Name>
      <Long_Name>Systeme Observation de la Terre-5</Long_Name>
      <Instrument>
        <Short_Name>VEGETATION-2</Short_Name>
        <Long_Name>VEGETATION INSTRUMENT 2 (SPOT 5)</Long_Name>
      </Instrument>
    </Platform>
</DIF>`

describe('when applying platform DIF10 corrections', () => {
  test('should apply long name correction to first Platform', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-4'
          },
          newKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-4'
          },
          newLongName: 'Systeme Observation de la Terre-4 Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Systeme Observation de la Terre-4 Updated</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Systeme Observation de la Terre-4</Long_Name>')

    // Other Type should remain unchanged
    expect(result.correctedMetadata).toContain('<Long_Name>Systeme Observation de la Terre-5</Long_Name>')

    // Instrument stays untouched
    expect(result.correctedMetadata).toContain('<Short_Name>VEGETATION-1</Short_Name>')

    // Platform type untouched
    expect(result.correctedMetadata).toContain('<Type>Earth Observation Satellites</Type>')
  })

  test('should update both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-5'
          },
          newKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-7-New'
          },
          newLongName: 'Systeme Observation de la Terre-5 Updated'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>SPOT-7-New</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>SPOT-7</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Systeme Observation de la Terre-5 Updated</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Systeme Observation de la Terre-5</Long_Name>')

    expect(result.correctedMetadata).toContain('<Type>Earth Observation Satellites</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>Earth Observation planes</Type>')
  })

  test('should apply platform correction when there is only a single platform (object branch)', async () => {
    const singlePlatformXml = `<DIF>
      <Entry_ID>
          <Short_Name>SINGLE_PLAT_TEST</Short_Name>
          <Version>001</Version>
      </Entry_ID>
      <Platform>
          <Type>In Situ Land-based Platforms</Type>
          <Short_Name>GROUND STATIONS</Short_Name>
          <Long_Name>Long Name to be replaced</Long_Name>
      </Platform>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singlePlatformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Category: '',
            Class: 'In Situ Land-based Platforms',
            Type: '',
            ShortName: 'GROUND STATIONS'
          },
          newKeywordObject: {
            Category: '',
            Class: 'In Situ Land-based Platforms',
            Type: 'Aircraft',
            ShortName: 'C-130'
          },
          newLongName: 'Lockheed C-130 Hercules'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify the object branch was taken and updated the fields correctly
    expect(result.correctedMetadata).toContain('<Type>Aircraft</Type>')
    expect(result.correctedMetadata).toContain('<Short_Name>C-130</Short_Name>')
    expect(result.correctedMetadata).toContain('<Long_Name>Lockheed C-130 Hercules</Long_Name>')
    expect(result.correctedMetadata).not.toContain('GROUND STATIONS')
  })

  test('should delete parent Platform property when the last platform in an array is removed', async () => {
    const multiPlatformXml = `<DIF>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>A1</Short_Name>
      </Platform>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>A2</Short_Name>
      </Platform>
  </DIF>`

    // Applying two deletions to empty the array and trigger the length === 0 check
    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiPlatformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          oldKeywordObject: {
            Category: '',
            Class: 'Aircraft',
            Type: '',
            ShortName: 'A1'
          }
        },
        {
          scheme: 'platforms',
          action: 'delete',
          oldKeywordObject: {
            Category: '',
            Class: 'Aircraft',
            Type: '',
            ShortName: 'A2'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // The Platform key should be entirely removed from the resulting XML
    expect(result.correctedMetadata).not.toContain('<Platform>')
    expect(result.correctedMetadata).not.toContain('</Platform>')
  })

  test('should delete Platform', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          oldKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-4'
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Platform should be removed
    expect(result.correctedMetadata).not.toContain('<Type>Earth Observation Satellites</Type>')

    // Other Platform should be unchanged
    expect(result.correctedMetadata).toContain('<Type>Earth Observation planes</Type>')
  })

  test('should return false when an unrecognized action is passed to platforms', async () => {
    const platformOnlyXml = '<DIF><Platform><Short_Name>TEST</Short_Name></Platform></DIF>'

    const result = await applyDif10MetadataCorrections({
      metadataPayload: platformOnlyXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'not_an_action', // Triggers the final return false
          newKeywordObject: {
            Category: '',
            Class: 'A',
            Type: 'B',
            ShortName: 'C'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should cover the else branch by deleting a single platform object', async () => {
    const singlePlatformXml = `<DIF>
      <Entry_ID>
          <Short_Name>SINGLE_DELETE_TEST</Short_Name>
      </Entry_ID>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>A1</Short_Name>
      </Platform>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singlePlatformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'delete',
          oldKeywordObject: {
            Category: '',
            Class: 'Aircraft',
            Type: '',
            ShortName: 'A1'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // Verify the Platform tag is completely removed from the XML
    expect(result.correctedMetadata).not.toContain('<Platform>')
    expect(result.correctedMetadata).not.toContain('</Platform>')
  })

  test('should cover the field pruning else branch by providing a shorter keyword path', async () => {
    const platformXml = `<DIF>
      <Platform>
          <Type>Aircraft</Type>
          <Short_Name>OLD-SHORT</Short_Name>
          <Long_Name>Old Long Name that should be deleted</Long_Name>
      </Platform>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: platformXml,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Category: '',
            Class: 'Aircraft',
            Type: '',
            ShortName: 'OLD-SHORT'
          },
          // Providing only one segment forces the Long_Name field to hit the 'else { delete }' branch
          newKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'NEW-SHORT'
          },
          newLongName: ''
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify Short_Name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>NEW-SHORT</Short_Name>')

    // Verify Long_Name was deleted (this is the branch we are covering)
    expect(result.correctedMetadata).not.toContain('<Long_Name>')
    expect(result.correctedMetadata).not.toContain('Old Long Name that should be deleted')
  })

  test('should handle missing Platform element', async () => {
    const xmlWithoutPlatform = `<DIF>
        <Entry_ID>
            <Short_Name>NO_URL</Short_Name>
        </Entry_ID>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutPlatform,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          oldKeywordObject: {
            Category: '',
            Class: 'Earth Observation planes',
            Type: '',
            ShortName: 'SPOT-5'
          },
          newKeywordObject: {
            Category: '',
            Class: 'Earth Observation rockets',
            Type: '',
            ShortName: 'SPOT-7'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should match by old keyword path even when a stale ummPath is present', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithPlatforms,
      corrections: [
        {
          scheme: 'platforms',
          action: 'replace',
          ummPath: ['Platform', 10],
          oldKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-5'
          },
          newKeywordObject: {
            Category: '',
            Class: 'Space-based Platforms',
            Type: 'Earth Observation Satellites',
            ShortName: 'SPOT-7'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>SPOT-7</Short_Name>')
  })
})

describe('when applying Product_Level_Id DIF10 corrections', () => {
  const mockDif10WithProductLevel = `<DIF>
    <Product_Level_Id>Level 1B</Product_Level_Id>
</DIF>`

  describe('when replacing Product_Level_Id', () => {
    test('should successfully update the Product_Level_Id with a new string', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordObject: {
            Value: 'Level 2'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 2</Product_Level_Id>')
      expect(result.correctedMetadata).not.toContain('Level 1B')
    })

    test('should default to replace action if no action is provided', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          newKeywordObject: {
            Value: 'Level 3'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 3</Product_Level_Id>')
    })

    test('should return false and not modify the field if newKeywordObject is empty or invalid', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordObject: {} // Empty spaces
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 1B</Product_Level_Id>')
    })
  })

  describe('when deleting Product_Level_Id', () => {
    test('should successfully delete the Product_Level_Id key from the object', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<Product_Level_Id>')
    })

    test('should return false if trying to delete a Product_Level_Id that does not exist', async () => {
      const missingFieldXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: missingFieldXml,
        corrections: [{
          scheme: 'productlevelid',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })
  })

  describe('when handling Product_Level_Id edge cases', () => {
    test('should return empty count if metadataPayload is null or undefined', async () => {
      const resultNull = await applyDif10MetadataCorrections({
        metadataPayload: null,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordObject: {
            Value: 'Level 4'
          }
        }]
      })

      expect(resultNull.correctionCount).toBe(0)
      expect(resultNull.stubbed).toBe(true)
    })

    test('should return false if parsedMetadata does not contain a DIF object', async () => {
      const malformedXml = '<NOT_DIF><Product_Level_Id>Level 1B</Product_Level_Id></NOT_DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: malformedXml,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordObject: {
            Value: 'Level 4'
          }
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return false if an unknown action type is provided', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'invalid_action_type',
          newKeywordObject: {
            Value: 'Level 2'
          }
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<Product_Level_Id>Level 1B</Product_Level_Id>')
    })
  })
})

const mockDif10WithProjects = `<DIF>
    <Entry_ID>
        <Short_Name>Projects_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Projects</Entry_Title>
    <Project>
        <Short_Name>ESIP</Short_Name>
        <Long_Name>Earth Science Information Partners Program</Long_Name>
    </Project>
    <Project>
        <Short_Name>ALIENS</Short_Name>
        <Long_Name>Aliens in Antarctica</Long_Name>
    </Project>
</DIF>`

describe('when applying project DIF10 corrections', () => {
  test('should apply long name correction to first Project', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          },
          newKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          },
          newLongName: 'Updated Earth Science Information Partners Program'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Updated Earth Science Information Partners Program</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Earth Science Information Partners Program</Long_Name>')

    // Second long name stays untouched
    expect(result.correctedMetadata).toContain('<Long_Name>Aliens in Antarctica</Long_Name>')
  })

  test('should update both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            Category: 'A - C',
            ShortName: 'ALIENS'
          },
          newKeywordObject: {
            Category: 'A - C',
            ShortName: 'ALIENS UP'
          },
          newLongName: 'Aliens research in Antarctica'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>ALIENS UP</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>ALIENS</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Aliens research in Antarctica</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Aliens in Antarctica</Long_Name>')
  })

  test('should delete Project', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          oldKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Project should be removed
    expect(result.correctedMetadata).not.toContain('<Short_Name>ESIP</Short_Name>')

    // Other Project should be unchanged
    expect(result.correctedMetadata).toContain('<Short_Name>ALIENS</Short_Name>')
  })

  test('should delete the Project key when the last element of an array is removed', async () => {
    // Starting with an array of two projects (from mockDif10WithProjects)
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          oldKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          }
        },
        {
          scheme: 'projects',
          action: 'delete',
          oldKeywordObject: {
            Category: 'A - C',
            ShortName: 'ALIENS'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // This specifically triggers:
    // if (parent.Project.length === 0) { delete parent.Project }
    expect(result.correctedMetadata).not.toContain('<Project>')
  })

  test('should delete the Project key when it is a single object (non-array)', async () => {
    // XML with only one Project tag, which is parsed as a single object
    const singleProjectXml = `<DIF>
        <Project>
            <Short_Name>SINGLE-PROJ</Short_Name>
            <Long_Name>Single Project Test</Long_Name>
        </Project>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleProjectXml,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          oldKeywordObject: {
            Category: 'S - U',
            ShortName: 'SINGLE-PROJ'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // This specifically triggers:
    // } else { delete parent.Project }
    expect(result.correctedMetadata).not.toContain('<Project>')
    expect(result.correctedMetadata).not.toContain('SINGLE-PROJ')
  })

  test('should delete the Project key when it is a single object (non-array branch)', async () => {
    // XML with only one Project tag, which is parsed as a single object
    const singleProjectXml = `<DIF>
        <Project>
            <Short_Name>SINGLE-PROJ</Short_Name>
            <Long_Name>Single Project Test</Long_Name>
        </Project>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleProjectXml,
      corrections: [
        {
          scheme: 'projects',
          action: 'delete',
          oldKeywordObject: {
            Category: 'S - U',
            ShortName: 'SINGLE-PROJ'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // This specifically triggers:
    // } else { delete parent.Project }
    expect(result.correctedMetadata).not.toContain('<Project>')
    expect(result.correctedMetadata).not.toContain('SINGLE-PROJ')
  })

  test('should handle missing Project element', async () => {
    const xmlWithoutProject = `<DIF>
        <Entry_ID>
            <Short_Name>No_project</Short_Name>
        </Entry_ID>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutProject,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          },
          newKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP-7'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should delete a specific field (Long_Name) within a Project when the new value is undefined', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          },
          // Providing a single segment and NO newLongName
          // results in normalizedSegments[1] (Long_Name) being undefined
          newKeywordObject: {
            Category: 'M - O',
            ShortName: 'ONLY_SHORT'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify Short_Name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>ONLY_SHORT</Short_Name>')

    // 2. Verify the OLD Long_Name for Project 0 is gone
    expect(result.correctedMetadata).not.toContain('Earth Science Information Partners Program')

    // 3. Verify that Project 1 still HAS its Long_Name (proving we didn't delete everything)
    expect(result.correctedMetadata).toContain('<Long_Name>Aliens in Antarctica</Long_Name>')
  })

  test('should match by old keyword path even when a stale ummPath is present', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          ummPath: ['Project', 10],
          oldKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          },
          newKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP-7'
          },
          newLongName: 'Updated Earth Science Information Partners Program'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>ESIP-7</Short_Name>')
  })

  describe('when guard clauses prevent a correction', () => {
    test('should return false if oldKeywordObject is missing', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProjects,
        corrections: [{
          scheme: 'projects'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return false if Project tag is missing from metadata', async () => {
      const xmlWithoutProject = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: xmlWithoutProject,
        corrections: [{
          scheme: 'projects'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return false if the current project path cannot be matched', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProjects,
        corrections: [{
          scheme: 'projects',
          oldKeywordObject: {
            Category: 'S - U',
            ShortName: 'NOT-REAL'
          }
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return false for unsupported action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithProjects,
        corrections: [{
          scheme: 'projects',
          action: 'invalid_action'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })
  })
})

const mockDif10WithProviders = `<DIF>
    <Entry_ID>
        <Short_Name>Providers_Test</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Providers</Entry_Title>
    <Organization>
        <Organization_Type>ARCHIVER</Organization_Type>
        <Organization_Name>
            <Short_Name>BROWN/GEO</Short_Name>
            <Long_Name>Department of Geological Sciences, Brown University</Long_Name>
        </Organization_Name>
        <Hours_Of_Service>0800-1600</Hours_Of_Service>
        <Instructions>In addition to the address below there are other ESIC offices throught the country. Afull list of these offices is at:&lt;URL: http://www-nmd.usgs.gov/esic/esic_index.html&gt;</Instructions>
        <Personnel>
            <Role>DATA CENTER CONTACT</Role>
            <Contact_Person>
                <First_Name>Customer</First_Name>
                <Middle_Name>Services</Middle_Name>
                <Last_Name>Representative</Last_Name>
            </Contact_Person>
        </Personnel>
    </Organization>
    <Organization>
        <Organization_Type>DISTRIBUTOR</Organization_Type>
        <Organization_Name>
            <Short_Name>ESRI-CANADA</Short_Name>
            <Long_Name>Environmental Systems Research Institute, Inc. - Canada</Long_Name>
        </Organization_Name>
        <Hours_Of_Service>0800-1630</Hours_Of_Service>
        <Instructions>In addition to the address below there are other ESIC offices throught the country. Afull list of these offices is at:&lt;URL: http://www-nmd.usgs.gov/esic/esic_index.html&gt;</Instructions>
        <Personnel>
            <Role>DATA CENTER CONTACT</Role>
            <Contact_Person>
                <Last_Name>Not provided</Last_Name>
            </Contact_Person>
        </Personnel>
    </Organization>
</DIF>`

describe('when applying provider DIF10 corrections', () => {
  test('should apply long name correction to first provider', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            BucketLevel0: 'ACADEMIC',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'BROWN/GEO'
          },
          newKeywordObject: {
            BucketLevel0: 'ACADEMIC',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'BROWN/GEO'
          },
          newLongName: 'Department of Geological Sciences, Brown University East'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Department of Geological Sciences, Brown University East</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Department of Geological Sciences, Brown University</Long_Name>')

    // Other long name should remain unchanged
    expect(result.correctedMetadata).toContain('<Long_Name>Environmental Systems Research Institute, Inc. - Canada</Long_Name>')

    // Hours of service stays untouched
    expect(result.correctedMetadata).toContain('<Hours_Of_Service>0800-1600</Hours_Of_Service>')
  })

  test('should update both short name and long name', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI-CANADA'
          },
          newKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI2-CANADA'
          },
          newLongName: 'Environmental Systems Research Institute 2, Inc. - Canada'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<Short_Name>ESRI2-CANADA</Short_Name>')
    expect(result.correctedMetadata).not.toContain('<Short_Name>ESRI-CANADA</Short_Name>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<Long_Name>Environmental Systems Research Institute 2, Inc. - Canada</Long_Name>')
    expect(result.correctedMetadata).not.toContain('<Long_Name>Environmental Systems Research Institute, Inc. - Canada</Long_Name>')
  })

  test('should delete Provider', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'delete',
          oldKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI-CANADA'
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Provider should be removed
    expect(result.correctedMetadata).not.toContain('ESRI-CANADA')

    // Other Provider should be unchanged
    expect(result.correctedMetadata).toContain('<Short_Name>BROWN/GEO</Short_Name>')
  })

  test('should handle missing Provider element', async () => {
    const xmlWithoutProvider = `<DIF>
        <Entry_ID>
            <Short_Name>No_instrument</Short_Name>
        </Entry_ID>
        <Platform>
          <Type>Air-based Platforms</Type>
          <Short_Name>UC-12B</Short_Name>
          <Long_Name>NASA Langley Beechcraft UC-12B Huron</Long_Name>
        </Platform>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutProvider,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI-CANADA'
          },
          newKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI2-CANADA'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should match by old keyword path even when a stale ummPath is present', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          ummPath: ['Organization_Name', 10],
          oldKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI-CANADA'
          },
          newKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI2-CANADA'
          },
          newLongName: 'Environmental Systems Research Institute 2, Inc. - Canada'
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Short_Name>ESRI2-CANADA</Short_Name>')
  })

  test('should return false when the current provider path cannot be matched', async () => {
    // Organization block without the Organization_Name child
    const missingNameXml = `<DIF>
        <Organization>
            <Organization_Type>ARCHIVER</Organization_Type>
        </Organization>
      </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: missingNameXml,
      corrections: [{
        scheme: 'providers',
        action: 'replace',
        oldKeywordObject: {
          BucketLevel0: 'ARCHIVER',
          BucketLevel1: '',
          BucketLevel2: '',
          BucketLevel3: '',
          ShortName: 'MISSING'
        },
        newKeywordObject: {
          BucketLevel0: '',
          BucketLevel1: '',
          BucketLevel2: '',
          BucketLevel3: '',
          ShortName: 'SHORT'
        },
        newLongName: 'LONG'
      }]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctedMetadata).not.toContain('<Short_Name>SHORT</Short_Name>')
  })

  test('should remove the Organization key entirely when the last provider in an array is deleted', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'delete',
          oldKeywordObject: {
            BucketLevel0: 'ACADEMIC',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'BROWN/GEO'
          }
        },
        {
          scheme: 'providers',
          action: 'delete',
          oldKeywordObject: {
            BucketLevel0: 'COMMERCIAL',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'ESRI-CANADA'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(2)
    // This triggers: if (parent.Organization.length === 0) { delete parent.Organization }
    expect(result.correctedMetadata).not.toContain('<Organization>')
  })

  test('should delete the Organization key when it contains a single object instead of an array', async () => {
    const singleOrgXml = '<DIF><Organization><Organization_Name><Short_Name>O</Short_Name></Organization_Name></Organization></DIF>'
    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleOrgXml,
      corrections: [{
        scheme: 'providers',
        action: 'delete',
        oldKeywordObject: {
          BucketLevel0: 'ORG',
          BucketLevel1: '',
          BucketLevel2: '',
          BucketLevel3: '',
          ShortName: 'O'
        }
      }]
    })

    // This triggers the 'else' branch: delete parent.Organization
    expect(result.correctedMetadata).not.toContain('<Organization>')
  })

  test('should remove a specific provider field when the replacement value is empty or undefined', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProviders,
      corrections: [{
        scheme: 'providers',
        action: 'replace',
        oldKeywordObject: {
          BucketLevel0: 'ACADEMIC',
          BucketLevel1: '',
          BucketLevel2: '',
          BucketLevel3: '',
          ShortName: 'BROWN/GEO'
        },
        // Providing only one segment and no newLongName should prune the existing Long_Name field.
        newKeywordObject: {
          BucketLevel0: '',
          BucketLevel1: '',
          BucketLevel2: '',
          BucketLevel3: '',
          ShortName: 'ONLY_SHORT'
        }
      }]
    })

    // This triggers: } else { delete target[field] }
    expect(result.correctedMetadata).toContain('<Short_Name>ONLY_SHORT</Short_Name>')
    // Check that the specific Long_Name of the first provider was deleted
    expect(result.correctedMetadata).not.toContain('Department of Geological Sciences, Brown University')
  })

  test('should return false and make no changes when an unsupported action is provided', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithProviders,
      corrections: [{
        scheme: 'providers',
        action: 'invalid_action'
      }]
    })

    // This triggers the final: return false
    expect(result.correctionCount).toBe(0)
  })
})

const mockDif10WithRelatedURLs = `<DIF>
    <Entry_ID>
        <Short_Name>RELATED_URL_TEST</Short_Name>
        <Version>001</Version>
    </Entry_ID>
    <Entry_Title>Test Collection with Related URLs</Entry_Title>
    <Related_URL>
        <URL_Content_Type>
            <Type>GET DATA</Type>
        </URL_Content_Type>
        <URL>https://example.com/data</URL>
    </Related_URL>
    <Related_URL>
        <URL_Content_Type>
            <Type>GET CAPABILITIES</Type>
            <Subtype>OpenSearch</Subtype>
        </URL_Content_Type>
        <URL>https://example.com/opensearch</URL>
    </Related_URL>
    <Related_URL>
        <URL_Content_Type>
            <Type>USE SERVICE API</Type>
            <Subtype>REST</Subtype>
        </URL_Content_Type>
        <URL>https://example.com/api</URL>
    </Related_URL>
</DIF>`

describe('when applying related URL content type DIF10 corrections', () => {
  test('should apply URL content type correction to first Related_URL', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          }, // Last 2 segments: 'GET DATA' and ''
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET SERVICE',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify first URL's type was updated
    expect(result.correctedMetadata).toContain('<Type>GET SERVICE</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>GET DATA</Type>')

    // Other URLs should remain unchanged
    expect(result.correctedMetadata).toContain('<Type>GET CAPABILITIES</Type>')
    expect(result.correctedMetadata).toContain('<Type>USE SERVICE API</Type>')
  })

  test('should update both type and subtype', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET CAPABILITIES',
            Subtype: 'OpenSearch'
          }, // Last 2 segments: 'GET CAPABILITIES' and 'OpenSearch'
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET CAPABILITIES',
            Subtype: 'OGC WMS'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify subtype was updated
    expect(result.correctedMetadata).toContain('<Subtype>OGC WMS</Subtype>')
    expect(result.correctedMetadata).not.toContain('<Subtype>OpenSearch</Subtype>')

    // Type should remain the same
    expect(result.correctedMetadata).toContain('<Type>GET CAPABILITIES</Type>')
  })

  test('should add subtype to URL that only had type', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
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

    expect(result.correctedMetadata).toContain('<Type>GET DATA</Type>')
    expect(result.correctedMetadata).toContain('<Subtype>DIRECT DOWNLOAD</Subtype>')
  })

  test('should remove subtype when moving to type-only', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'USE SERVICE API',
            Subtype: 'REST'
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET DATA',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Type should be updated
    const getDataMatches = result.correctedMetadata.match(/<Type>GET DATA<\/Type>/g)
    expect(getDataMatches.length).toBeGreaterThan(0)

    // REST subtype should be removed from third URL
    expect(result.correctedMetadata).not.toContain('<Subtype>REST</Subtype>')
  })

  test('should delete URL_Content_Type from Related_URL', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'delete',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET CAPABILITIES',
            Subtype: 'OpenSearch'
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // URL_Content_Type should be removed from second Related_URL
    expect(result.correctedMetadata).not.toContain('OpenSearch')

    // But the Related_URL itself should remain
    expect(result.correctedMetadata).toContain('https://example.com/opensearch')

    // Other Related_URLs should be unchanged
    expect(result.correctedMetadata).toContain('<Type>GET DATA</Type>')
    expect(result.correctedMetadata).toContain('<Type>USE SERVICE API</Type>')
  })

  test('should handle single Related_URL (not array)', async () => {
    const singleUrlXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_URL</Short_Name>
    </Entry_ID>
    <Related_URL>
        <URL_Content_Type>
            <Type>VIEW PROJECT HOME PAGE</Type>
        </URL_Content_Type>
        <URL>https://example.com</URL>
    </Related_URL>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleUrlXml,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'VIEW PROJECT HOME PAGE',
            Subtype: ''
          },
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'VIEW RELATED INFORMATION',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<Type>VIEW RELATED INFORMATION</Type>')
    expect(result.correctedMetadata).not.toContain('VIEW PROJECT HOME PAGE')
  })

  test('should handle missing Related_URL element', async () => {
    const xmlWithoutRelatedURL = `<DIF>
    <Entry_ID>
        <Short_Name>NO_URL</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
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
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should remove a specific content type field when the replacement value is empty or undefined', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'replace',
        oldKeywordObject: {
          URLContentType: 'DistributionURL',
          Type: 'GET CAPABILITIES',
          Subtype: 'OpenSearch'
        },
        newKeywordObject: {
          URLContentType: '',
          Type: 'JUST_A_TYPE',
          Subtype: ''
        } // Last 2 segments: 'JUST_A_TYPE' and ''
      }]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify the specific target was updated
    expect(result.correctedMetadata).toContain('<Type>JUST_A_TYPE</Type>')

    // 2. Verify the specific OLD Subtype is gone
    expect(result.correctedMetadata).not.toContain('OpenSearch')

    // 3. Verify that other Subtypes in different blocks are UNTOUCHED
    expect(result.correctedMetadata).toContain('<Subtype>REST</Subtype>')
  })

  test('should return false and make no changes when an unsupported action is provided', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
        scheme: 'rucontenttype',
        action: 'unsupported_action',
        oldKeywordObject: {
          URLContentType: 'DistributionURL',
          Type: 'GET DATA',
          Subtype: ''
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
  })

  test('should remove the URL_Content_Type container entirely if all its fields are deleted', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [{
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
        } // Last 2 segments: '' and ''
      }]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify the specific value is gone
    expect(result.correctedMetadata).not.toContain('GET DATA')

    // 2. Verify the structure has dropped URL_Content_Type for index 0 completely
    expect(result.correctedMetadata).toMatch(
      /<Related_URL>\s*<URL>https:\/\/example\.com\/data<\/URL>\s*<\/Related_URL>/
    )

    // 3. Verify we didn't accidentally delete URL_Content_Type from other blocks
    expect(result.correctedMetadata).toContain('<Type>USE SERVICE API</Type>')
  })

  test('should return false when oldKeywordObject does not match any current elements', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10WithRelatedURLs,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'NOT_REAL_TYPE',
            Subtype: ''
          }, // Will not find a value match
          newKeywordObject: {
            URLContentType: 'DistributionURL',
            Type: 'GET SERVICE',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should preserve existing element attributes when replacing the text content', async () => {
    const xmlWithAttributes = `<DIF>
        <Related_URL>
            <URL_Content_Type>
                <Type secure="true">GET DATA</Type>
            </URL_Content_Type>
            <URL>https://example.com/data</URL>
        </Related_URL>
    </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: xmlWithAttributes,
      corrections: [
        {
          scheme: 'rucontenttype',
          action: 'replace',
          oldKeywordObject: {
            Type: 'GET DATA',
            Subtype: ''
          },
          newKeywordObject: {
            Type: 'GET SERVICE',
            Subtype: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('>GET SERVICE</Type>')
    expect(result.correctedMetadata).not.toContain('GET DATA')
  })
})

const mockDif10Xml = `<DIF
    xmlns:dif="http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/ http://gcmd.gsfc.nasa.gov/Aboutus/xml/dif/dif_v10.2.xsd">
            <Entry_ID>
                <Short_Name>DEM_100M</Short_Name>
                <Version>001</Version>
            </Entry_ID>
            <Entry_Title>100m Digital Elevation Model Data V001</Entry_Title>
            <Science_Keywords>
                <Category>EARTH SCIENCE</Category>
                <Topic>LAND SURFACE</Topic>
                <Term>TOPOGRAPHY</Term>
                <Variable_Level_1>LANDFORMS</Variable_Level_1>
                <Variable_Level_2>DEM</Variable_Level_2>
            </Science_Keywords>
            <Science_Keywords>
                <Category>EARTH SCIENCE</Category>
                <Topic>LAND SURFACE</Topic>
                <Term>TOPOGRAPHY</Term>
                <Variable_Level_1>TERRAIN ELEVATION</Variable_Level_1>
                <Variable_Level_2>DIGITAL TERRAIN MODEL</Variable_Level_2>
            </Science_Keywords>
            <Platform>
                <Type>Not provided</Type>
                <Short_Name>Not provided</Short_Name>
            </Platform>
</DIF>`

const mockSimpleDif10Xml = `<DIF>
    <Entry_ID>
        <Short_Name>TEST_COLLECTION</Short_Name>
    </Entry_ID>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
        <Term>AEROSOLS</Term>
        <Variable_Level_1>LEGACY AEROSOLS</Variable_Level_1>
    </Science_Keywords>
</DIF>`

describe('when applying science keyword DIF10 corrections', () => {
  test('should apply science keyword renaming correction (same hierarchy, different name)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
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
    expect(result.correctionsApplied).toHaveLength(1)
    expect(result.stubbed).toBe(false)

    // Verify the corrected XML contains the renamed keyword
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).toContain('<Topic>ATMOSPHERE</Topic>')
    expect(result.correctedMetadata).toContain('<Term>AEROSOLS</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>AEROSOLS RENAMED</Variable_Level_1>')
    // Old name should be gone
    expect(result.correctedMetadata).not.toContain('LEGACY AEROSOLS')
  })

  test('should apply science keyword hierarchy move (same name, different topic)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
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
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the keyword moved to the new topic
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).toContain('<Topic>AIR QUALITY</Topic>')
    expect(result.correctedMetadata).toContain('<Term>AEROSOLS</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>LEGACY AEROSOLS</Variable_Level_1>')
    // Old topic should be gone
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('should apply hierarchy move with renaming at same level', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
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
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify new hierarchy
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).toContain('<Topic>LAND SURFACE</Topic>')
    expect(result.correctedMetadata).toContain('<Term>ELEVATION</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>TERRAIN FEATURES</Variable_Level_1>')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DIGITAL ELEVATION MODEL</Variable_Level_2>')

    // Old values should be gone from first keyword (second keyword still has TOPOGRAPHY)
    const topographyMatches = result.correctedMetadata.match(/<Term>TOPOGRAPHY<\/Term>/g)
    expect(topographyMatches).toHaveLength(1) // Only in second keyword
    expect(result.correctedMetadata).not.toContain('LANDFORMS')
  })

  test('should apply correction to second keyword in array', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 1],
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
    expect(result.correctionsApplied).toHaveLength(1)

    // First keyword should remain unchanged
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DEM</Variable_Level_2>')

    // Second keyword should be updated with new names
    expect(result.correctedMetadata).toContain('<Variable_Level_1>ELEVATION DATA</Variable_Level_1>')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DIGITAL ELEVATION DATA</Variable_Level_2>')
    // Old values should be gone
    expect(result.correctedMetadata).not.toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('should remove science keyword when delete action is applied', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 0],
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'LANDFORMS',
            VariableLevel2: 'DEM',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // First keyword should be removed
    expect(result.correctedMetadata).not.toContain('LANDFORMS')
    expect(result.correctedMetadata).not.toContain('<Detailed_Variable>DEM</Detailed_Variable>')

    // Second keyword should remain
    expect(result.correctedMetadata).toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).toContain('DIGITAL TERRAIN MODEL')
  })

  test('should remove second science keyword when delete action is applied', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 1],
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'TERRAIN ELEVATION',
            VariableLevel2: 'DIGITAL TERRAIN MODEL',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // First keyword should remain
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('DEM')

    // Second keyword should be removed
    expect(result.correctedMetadata).not.toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('should delete parent Science_Keywords property when the last keyword in an array is removed', async () => {
    const multiKeywordXml = `<DIF>
      <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>ATMOSPHERE</Topic>
          <Term>AEROSOLS</Term>
      </Science_Keywords>
      <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>OCEANS</Topic>
          <Term>MARINE SEDIMENTS</Term>
      </Science_Keywords>
  </DIF>`

    // Since lookups are by path format value string, we specify the exact old keyword path values
    const result = await applyDif10MetadataCorrections({
      metadataPayload: multiKeywordXml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['ScienceKeywords', 0],
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        },
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['ScienceKeywords', 1],
          oldKeywordObject: {
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

    expect(result.correctionCount).toBe(2)
    // Verify the entire container is gone from the XML
    expect(result.correctedMetadata).not.toContain('<Science_Keywords>')
    expect(result.correctedMetadata).not.toContain('</Science_Keywords>')
  })

  test('should return false when an unsupported action is provided', async () => {
    const singleScienceKeywordXml = `<DIF>
      <Science_Keywords>
          <Category>EARTH SCIENCE</Category>
          <Topic>ATMOSPHERE</Topic>
          <Term>AEROSOLS</Term>
      </Science_Keywords>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      metadataPayload: singleScienceKeywordXml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'invalid_action_type', // Neither 'replace' nor 'delete'
          ummPath: ['ScienceKeywords', 0],
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

    // The delegate returns false, so the orchestrator does not increment the count
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should apply multiple science keyword corrections (mix of rename and move)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
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
          ummPath: ['Science_Keywords', 1],
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
    expect(result.correctionsApplied).toHaveLength(2)

    // First keyword: renamed DEM to DIGITAL ELEVATION MODEL
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DIGITAL ELEVATION MODEL</Variable_Level_2>')

    // Second keyword: moved to completely different hierarchy
    expect(result.correctedMetadata).toContain('TERRESTRIAL HYDROSPHERE')
    expect(result.correctedMetadata).toContain('SURFACE WATER')
    expect(result.correctedMetadata).toContain('<Variable_Level_2>DTM</Variable_Level_2>')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('should apply term-level rename within same category and topic', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
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
            Term: 'SURFACE TOPOGRAPHY',
            VariableLevel1: 'LANDFORMS',
            VariableLevel2: 'DEM',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify term changed from TOPOGRAPHY to SURFACE TOPOGRAPHY
    expect(result.correctedMetadata).toContain('<Term>SURFACE TOPOGRAPHY</Term>')
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('DEM')

    // Old term should still exist in second keyword
    const topographyMatches = result.correctedMetadata.match(/<Term>TOPOGRAPHY<\/Term>/g)
    expect(topographyMatches).toHaveLength(1) // Only in second keyword
  })

  test('should apply category-level change (moving keyword to different category)', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
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

    // Verify category changed completely
    expect(result.correctedMetadata).toContain('<Category>EARTH SCIENCE SERVICES</Category>')
    expect(result.correctedMetadata).toContain('<Topic>DATA ANALYSIS AND VISUALIZATION</Topic>')
    expect(result.correctedMetadata).toContain('<Term>AEROSOL ANALYSIS</Term>')
    expect(result.correctedMetadata).toContain('<Variable_Level_1>LEGACY AEROSOLS</Variable_Level_1>')

    // Old category should be gone
    expect(result.correctedMetadata).not.toContain('<Category>EARTH SCIENCE</Category>')
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('should handle single science keyword (not array) with replacement', async () => {
    const singleKeywordXml = `<DIF>
    <Entry_ID>
        <Short_Name>SINGLE_KEYWORD</Short_Name>
    </Entry_ID>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
        <Term>CLOUDS</Term>
    </Science_Keywords>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleKeywordXml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'CLOUDS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'CLOUD PROPERTIES',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('CLOUD PROPERTIES')
    expect(result.correctedMetadata).not.toContain('<Term>CLOUDS</Term>')
  })

  test('should delete only science keyword and removes Science_Keywords element', async () => {
    const singleKeywordXml = `<DIF>
    <Entry_ID>
        <Short_Name>DELETE_ONLY_KEYWORD</Short_Name>
    </Entry_ID>
    <Science_Keywords>
        <Category>EARTH SCIENCE</Category>
        <Topic>ATMOSPHERE</Topic>
    </Science_Keywords>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: singleKeywordXml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 0],
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: '',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    // Science_Keywords element should be completely removed
    expect(result.correctedMetadata).not.toContain('Science_Keywords')
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('should handle multiple deletes reducing array to single element', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'delete',
          ummPath: ['Science_Keywords', 1],
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'LAND SURFACE',
            Term: 'TOPOGRAPHY',
            VariableLevel1: 'TERRAIN ELEVATION',
            VariableLevel2: 'DIGITAL TERRAIN MODEL',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {}
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // First keyword remains
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('DEM')

    // Second keyword deleted
    expect(result.correctedMetadata).not.toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('should skip correction when keyword path does not match any items in document', async () => {
    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleDif10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          // This path does not exist in mockSimpleDif10Xml, so lookup fails
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
    expect(result.correctionsApplied).toHaveLength(0)

    // Original XML should be unchanged
    expect(result.correctedMetadata).toContain('LEGACY AEROSOLS')
  })

  test('should handle missing Science_Keywords element', async () => {
    const xmlWithoutKeywords = `<DIF>
    <Entry_ID>
        <Short_Name>NO_KEYWORDS</Short_Name>
    </Entry_ID>
</DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithoutKeywords,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
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
    expect(result.correctionsApplied).toHaveLength(0)
  })

  test('should handle science keywords where leaves are parsed as objects with a #text property', async () => {
    // Simulating an XML snippet where an attribute or formatting causes
    // fast-xml-parser to turn a node into an object structure rather than a raw string
    const xmlWithComplexNodes = `<DIF>
      <Entry_ID>
          <Short_Name>COMPLEX_LEAF_TEST</Short_Name>
      </Entry_ID>
      <Science_Keywords>
          <Category xml:lang="en">EARTH SCIENCE</Category>
          <Topic>ATMOSPHERE</Topic>
          <Term>CLOUDS</Term>
      </Science_Keywords>
  </DIF>`

    const result = await applyDif10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithComplexNodes,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          // This should match despite <Category> being parsed as an object internally
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'CLOUDS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'CLOUD PROPERTIES',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctionsApplied).toHaveLength(1)

    // Verify the substitution took place seamlessly
    expect(result.correctedMetadata).toContain('<Term>CLOUD PROPERTIES</Term>')
    expect(result.correctedMetadata).not.toContain('<Term>CLOUDS</Term>')
  })
})

const mockDif10WithTemporalResolution = `<DIF>
    <Data_Resolution>
        <Temporal_Resolution_Range>Monthly</Temporal_Resolution_Range>
        <Temporal_Resolution_Range>Daily</Temporal_Resolution_Range>
    </Data_Resolution>
</DIF>`

describe('when applying temporal resolution DIF10 corrections', () => {
  test('should ignore temporal resolution corrections because DIF10 does not support that field mapping', async () => {
    const result = await applyDif10MetadataCorrections({
      metadataPayload: mockDif10WithTemporalResolution,
      corrections: [{
        scheme: 'temporalresolutionrange',
        action: 'delete',
        oldKeywordObject: {
          Value: 'Daily'
        }
      }]
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
    expect(result.correctedMetadata).toContain('<Temporal_Resolution_Range>Monthly</Temporal_Resolution_Range>')
    expect(result.correctedMetadata).toContain('<Temporal_Resolution_Range>Daily</Temporal_Resolution_Range>')
  })
})

const mockDif10WithVerticalResolution = `<DIF>
    <Data_Resolution>
        <Vertical_Resolution_Range>1 - 10 meters</Vertical_Resolution_Range>
        <Vertical_Resolution_Range>10 - 50 meters</Vertical_Resolution_Range>
    </Data_Resolution>
</DIF>`

describe('when applying vertical resolution DIF10 corrections', () => {
  describe('when replacing values', () => {
    test('should replace a specific vertical range in an array', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'replace',
          ummPath: ['VerticalResolutionRanges', 1],
          newKeywordObject: {
            Value: 'Updated Range'
          },
          oldKeywordObject: {
            Value: '10 - 50 meters'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Vertical_Resolution_Range>Updated Range</Vertical_Resolution_Range>')
      expect(result.correctedMetadata).toContain('<Vertical_Resolution_Range>1 - 10 meters</Vertical_Resolution_Range>')
    })

    test('should replace a single vertical range value when it is not in an array', async () => {
      const singleXml = '<DIF><Data_Resolution><Vertical_Resolution_Range>Old Range</Vertical_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'replace',
          ummPath: ['VerticalResolutionRanges', 0],
          newKeywordObject: {
            Value: 'New Range'
          },
          oldKeywordObject: {
            Value: 'Old Range'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<Vertical_Resolution_Range>New Range</Vertical_Resolution_Range>')
    })
  })

  describe('when deleting values and cleaning up empty containers', () => {
    test('should delete a range from an array and keep the parent when it is not empty', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'delete',
          ummPath: ['VerticalResolutionRanges', 0],
          oldKeywordObject: {
            Value: '1 - 10 meters'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('1 - 10 meters')
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
    })

    test('should delete the Data_Resolution parent when the last range is removed', async () => {
      const singleXml = '<DIF><Data_Resolution><Vertical_Resolution_Range>Final Range</Vertical_Resolution_Range></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: singleXml,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'delete',
          ummPath: ['VerticalResolutionRanges', 0],
          oldKeywordObject: {
            Value: 'Final Range'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      // Both the field and parent container should be pruned
      expect(result.correctedMetadata).not.toContain('<Vertical_Resolution_Range>')
      expect(result.correctedMetadata).not.toContain('<Data_Resolution>')
    })

    test('should delete the target field when an array becomes empty but keeps Data_Resolution if other fields exist', async () => {
      // Setup XML with multiple vertical ranges and another unrelated field
      const multiFieldXml = `<DIF>
          <Data_Resolution>
              <Vertical_Resolution_Range>Range 1</Vertical_Resolution_Range>
              <Vertical_Resolution_Range>Range 2</Vertical_Resolution_Range>
              <Horizontal_Resolution_Range>Keep Me</Horizontal_Resolution_Range>
          </Data_Resolution>
      </DIF>`

      const result = await applyDif10MetadataCorrections({
        metadataPayload: multiFieldXml,
        corrections: [
          {
            scheme: 'verticalresolutionrange',
            action: 'delete',
            ummPath: ['VerticalResolutionRanges', 0],
            oldKeywordObject: {
              Value: 'Range 1'
            }
          },
          {
            scheme: 'verticalresolutionrange',
            action: 'delete',
            ummPath: ['VerticalResolutionRanges', 0],
            oldKeywordObject: {
              Value: 'Range 2'
            }
          }
        ]
      })

      expect(result.correctionCount).toBe(2)
      // This explicitly triggers: if (ranges.length === 0) { delete resolution[targetField] }
      expect(result.correctedMetadata).not.toContain('<Vertical_Resolution_Range>')

      // Data_Resolution should still exist because Horizontal_Resolution_Range is present
      expect(result.correctedMetadata).toContain('<Data_Resolution>')
      expect(result.correctedMetadata).toContain('<Horizontal_Resolution_Range>Keep Me</Horizontal_Resolution_Range>')
    })
  })

  describe('when guard clauses prevent a correction', () => {
    test('should return false if ummPath is missing a numeric index', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          ummPath: ['VerticalResolutionRanges'] // Missing numeric index
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false if Data_Resolution tag is missing', async () => {
      const emptyXml = '<DIF><Entry_ID><Short_Name>TEST</Short_Name></Entry_ID></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: emptyXml,
        corrections: [{
          scheme: 'verticalresolutionrange',
          ummPath: ['VerticalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false if Vertical_Resolution_Range is missing', async () => {
      const xmlNoRange = '<DIF><Data_Resolution><Other_Field>Value</Other_Field></Data_Resolution></DIF>'
      const result = await applyDif10MetadataCorrections({
        metadataPayload: xmlNoRange,
        corrections: [{
          scheme: 'verticalresolutionrange',
          ummPath: ['VerticalResolutionRanges', 0]
        }]
      })
      expect(result.correctionCount).toBe(0)
    })

    test('should return false for unrecognized action', async () => {
      const result = await applyDif10MetadataCorrections({
        metadataPayload: mockDif10WithVerticalResolution,
        corrections: [{
          scheme: 'verticalresolutionrange',
          action: 'unsupported_action',
          ummPath: ['VerticalResolutionRanges', 0],
          oldKeywordObject: {
            Value: '1 - 10 meters'
          }
        }]
      })
      expect(result.correctionCount).toBe(0)
    })
  })
})
