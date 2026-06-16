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
  applyEcho10MetadataCorrections as applyEcho10MetadataCorrectionsRaw
} from '../applyEcho10MetadataCorrections'

const applyEcho10MetadataCorrections = (params = {}) => applyEcho10MetadataCorrectionsRaw(params)

const mockEcho10 = `
<Collection>
    <ShortName>Test_Collection</ShortName>
    <VersionId>001</VersionId>
    <ScienceKeywords>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>ATMOSPHERE</TopicKeyword>
            <TermKeyword>AEROSOLS</TermKeyword>
        </ScienceKeyword>
    </ScienceKeywords>
    <Platforms>
        <Platform>
            <Type>In Situ Land-based Platforms</Type>
            <ShortName>GROUND STATIONS</ShortName>
        </Platform>        
    </Platforms>
</Collection>`

const mockEcho10ForMetadataPreservation = `<Collection>
    <ShortName>PRESERVATION_TEST</ShortName>
    <VersionId>001</VersionId>
    <ScienceKeywords>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>ATMOSPHERE</TopicKeyword>
            <TermKeyword>AEROSOLS</TermKeyword>
        </ScienceKeyword>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>SOLID EARTH</TopicKeyword>
            <TermKeyword>TECTONICS</TermKeyword>
            <VariableLevel1Keyword>
                <Value>EARTHQUAKES</Value>
                <VariableLevel2Keyword>
                    <Value>SEISMIC PROFILE</Value>
                </VariableLevel2Keyword>
            </VariableLevel1Keyword>
            <DetailedVariableKeyword>RAIN</DetailedVariableKeyword>
        </ScienceKeyword>
    </ScienceKeywords>
    <Platforms>
        <Platform>
            <ShortName>SPOT-4</ShortName>
            <LongName>Systeme Observation de la Terre-4</LongName>
            <Type>Earth Observation Satellites</Type>
            <Instruments>
                <Instrument>
                    <ShortName>SEISMIC REFLECTION PROFILERS</ShortName>
                </Instrument>
                <Instrument>
                    <ShortName>GEOPHONES</ShortName>
                    <LongName>Geophone Array</LongName>
                </Instrument>
            </Instruments>
        </Platform>
        <Platform>
            <ShortName>NASA S-3B VIKING</ShortName>
            <Type>Aircraft</Type>
            <Instruments>
                <Instrument>
                    <ShortName>TSX-1</ShortName>
                    <LongName>Synthetic Aperture Radar</LongName>
                </Instrument>
            </Instruments>
        </Platform>
    </Platforms>
    <Campaigns>
        <Campaign>
            <ShortName>ALIENS</ShortName>
            <LongName>Aliens in Antarctica</LongName>
        </Campaign>
        <Campaign>
            <ShortName>ICEBRIDGE</ShortName>
            <LongName>IceBridge Mission</LongName>
        </Campaign>
    </Campaigns>
    <Contacts>
        <Contact>
            <ContactPersons>
                <Role>INVESTIGATOR</Role>
                <ContactPerson>
                    <FirstName>RAY</FirstName>
                    <LastName>DIBBLE</LastName>
                    <JobPosition>INVESTIGATOR</JobPosition>
                </ContactPerson>
            </ContactPersons>
        </Contact>
        <Contact>
            <Role>ARCHIVER</Role>
            <OrganizationName>NZ/NZAI/ANZ</OrganizationName>
            <ContactPersons>
                <ContactPerson>
                    <FirstName>SHULAMIT</FirstName>
                    <LastName>GORDON</LastName>
                    <JobPosition>DATA CENTER CONTACT</JobPosition>
                </ContactPerson>
            </ContactPersons>
        </Contact>
    </Contacts>
    <OnlineResources>
        <OnlineResource>
            <URL>https://example.org/opensearch</URL>
            <Description>OpenSearch endpoint</Description>
            <Type>DistributionURL : VIEW RELATED INFORMATION : OpenSearch</Type>
        </OnlineResource>
    </OnlineResources>
    <InsertTime>2009-03-03T00:00:00.000Z</InsertTime>
    <LastUpdate>2017-04-20T00:00:00.000Z</LastUpdate>
    <AdditionalAttributes>
        <AdditionalAttribute>
            <Name>metadata.keyword_version</Name>
            <DataType>FLOAT</DataType>
            <Description>Not provided</Description>
            <Value>8.1</Value>
        </AdditionalAttribute>
    </AdditionalAttributes>
    <DataFormat>netCDF-4</DataFormat>
    <ProcessingLevelId>NA</ProcessingLevelId>
</Collection>`

const parseXml = (xml) => new DOMParser().parseFromString(xml, 'text/xml')
const normalizeXmlText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const selectText = (document, expression) => {
  const node = xpath.select1(expression, document)

  return normalizeXmlText(node?.textContent)
}

const selectTexts = (document, expression) => xpath.select(expression, document)
  .map((node) => normalizeXmlText(node.textContent))

describe('when applying ECHO10 metadata corrections', () => {
  test('should return early if metadataPayload is missing', async () => {
    const result = await applyEcho10MetadataCorrections({ metadataPayload: null })
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
          Class: '',
          Type: 'In Situ Land-based Platforms',
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

    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10,
      corrections
    })

    expect(result.correctionCount).toBe(2)
    expect(result.correctionsApplied).toHaveLength(2)

    // Check XML Content
    expect(result.correctedMetadata).toContain('<TopicKeyword>OCEANS</TopicKeyword>')
    expect(result.correctedMetadata).toContain('<ShortName>C-130</ShortName>')
    expect(result.correctedMetadata).not.toContain('<TopicKeyword>ATMOSPHERE</TopicKeyword>')
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

    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10,
      corrections
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
    // Metadata should remain unchanged (save for standard formatting)
    expect(result.correctedMetadata).toContain('<TermKeyword>AEROSOLS</TermKeyword>')
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

    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10,
      corrections
    })

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toHaveLength(0)
    expect(result.correctedMetadata).toContain('<TermKeyword>AEROSOLS</TermKeyword>')
  })

  test('should verify XML declaration and formatting', async () => {
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10,
      corrections: []
    })

    expect(result.correctedMetadata).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(result.correctedMetadata).toContain('<Collection>')
  })
})

describe('when correcting a ECHO10 record', () => {
  test('should return a corrected ECHO10', async () => {
    const mockECHO10Xml = readFileSync(
      join(__dirname, '../__mocks__/echo10.xml'),
      'utf-8'
    )

    const corrections = [
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
        scheme: 'dataformat',
        action: 'replace',
        oldKeywordObject: {
          Value: 'netCDF-4'
        },
        newKeywordObject: {
          Value: 'HDF5'
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

    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockECHO10Xml,
      corrections
    })

    // 1. Assert expected overall modification telemetry
    expect(result.correctionCount).toBe(8)
    expect(result.stubbed).toBe(false)

    // 2. Assert exact extraction sequence of applied schemes
    const appliedSchemes = result.correctionsApplied.map((c) => c.scheme)
    expect(appliedSchemes).toEqual([
      'platforms',
      'instruments',
      'projects',
      'providers',
      'rucontenttype',
      'sciencekeywords',
      'dataformat',
      'ProductLevelId'
    ])

    // 3. Concrete XML assertions for each structural modification family
    const xml = result.correctedMetadata

    // Platforms verification
    expect(xml).toContain('<ShortName>SPOT-4-UPDATED</ShortName>')
    expect(xml).toContain('<LongName>Systeme Observation de la Terre-4 Updated</LongName>')

    // Instruments verification
    expect(xml).toContain('<ShortName>GEOPHONES-UPDATED</ShortName>')
    expect(xml).toContain('<LongName>Updated Geophone Array</LongName>')

    // Projects verification
    expect(xml).toContain('<ShortName>ALIENS-UPDATED</ShortName>')
    expect(xml).toContain('<LongName>Aliens in Antarctica Updated</LongName>')

    // Providers verification
    expect(xml).toContain('<OrganizationName>NZ/NZAI/ANZ-UPDATED</OrganizationName>')

    // RUContentType verification
    expect(xml).toContain('<Type>DistributionURL : VIEW RELATED INFORMATION : OGC WMS</Type>')
    expect(xml).not.toContain('<Type>DistributionURL : VIEW RELATED INFORMATION : OpenSearch</Type>')

    // ScienceKeywords verification
    expect(xml).toContain('<Value>SEDIMENT TRANSPORT</Value>')
    expect(xml).not.toContain('SEDIMENTARY STRUCTURES')

    // DataFormat verification
    expect(xml).toContain('<DataFormat>HDF5</DataFormat>')
    expect(xml).not.toContain('<DataFormat>netCDF-4</DataFormat>')

    // ProductLevelId verification
    expect(xml).toContain('<ProcessingLevelId>1A</ProcessingLevelId>')
    expect(xml).not.toContain('<ProcessingLevelId>NA</ProcessingLevelId>')
  })
})

describe('when verifying ECHO10 corrections do not remove unrelated metadata', () => {
  test('should preserve unrelated metadata while applying broad updates and deletes across supported fields', async () => {
    const originalDocument = parseXml(mockEcho10ForMetadataPreservation)
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10ForMetadataPreservation,
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
          scheme: 'dataformat',
          action: 'replace',
          oldKeywordObject: {
            Value: 'netCDF-4'
          },
          newKeywordObject: {
            Value: 'HDF5'
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

    expect(result.correctionCount).toBe(8)

    expect(selectTexts(updatedDocument, '//ScienceKeywords/ScienceKeyword/TopicKeyword')).toContain('OCEANS')
    expect(selectTexts(updatedDocument, '//ScienceKeywords/ScienceKeyword/TermKeyword')).toContain('MARINE SEDIMENTS')
    expect(selectTexts(updatedDocument, '//Platforms/Platform/ShortName')).toContain('SPOT-4-UPDATED')
    expect(selectText(updatedDocument, '//Platforms/Platform[ShortName="SPOT-4-UPDATED"]/LongName')).toBe('Systeme Observation de la Terre-4 Updated')
    expect(selectTexts(updatedDocument, '//Platforms/Platform[ShortName="SPOT-4-UPDATED"]/Instruments/Instrument/ShortName')).not.toContain('GEOPHONES')
    expect(selectTexts(updatedDocument, '//Platforms/Platform[ShortName="SPOT-4-UPDATED"]/Instruments/Instrument/ShortName')).toContain('SEISMIC REFLECTION PROFILERS')
    expect(selectTexts(updatedDocument, '//Campaigns/Campaign/ShortName')).toContain('ALIENS-UPDATED')
    expect(selectTexts(updatedDocument, '//Campaigns/Campaign/ShortName')).toContain('ICEBRIDGE')
    expect(selectText(updatedDocument, '//Contacts/Contact/OrganizationName')).toBe('NZ/NZAI/ANZ-UPDATED')
    expect(selectText(updatedDocument, '//OnlineResources/OnlineResource/Type')).toBe('DistributionURL : VIEW RELATED INFORMATION : OGC WMS')
    expect(selectText(updatedDocument, '//DataFormat')).toBe('HDF5')
    expect(selectText(updatedDocument, '//ProcessingLevelId')).toBe('1A')

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

    expect(selectTexts(updatedDocument, '//Platforms/Platform/ShortName')).toContain('NASA S-3B VIKING')
    expect(selectText(updatedDocument, '//Platforms/Platform[ShortName="NASA S-3B VIKING"]/Instruments/Instrument/ShortName')).toBe('TSX-1')
    expect(selectTexts(updatedDocument, '//ScienceKeywords/ScienceKeyword/TopicKeyword')).toContain('SOLID EARTH')
    expect(selectTexts(updatedDocument, '//ScienceKeywords/ScienceKeyword/VariableLevel1Keyword/Value')).toContain('EARTHQUAKES')
  })
})

const mockEcho10WithInstruments = `<Collection>
    <ShortName>Instruments_Test</ShortName>
    <VersionId>001</VersionId>
    <Platforms>
        <Platform>
            <ShortName>UC-12B</ShortName>
            <LongName>NASA Langley Beechcraft UC-12B Huron</LongName>
            <Type>Air-based Platforms</Type>
            <Instruments>
                <Instrument>
                    <ShortName>IRMSS</ShortName>
                    <LongName>Infrared Multispectral Scanner</LongName>
                </Instrument>
            </Instruments>
        </Platform>
        <Platform>
            <ShortName>MINTS</ShortName>
            <LongName>Multi-Scale Integrated Intelligent Interactive Sensing Consortium</LongName>
            <Type>Land-based Platforms</Type>
            <Instruments>
                <Instrument>
                    <ShortName>LISS-II</ShortName>
                    <LongName>Linear Imaging Self Scanning Sensor II</LongName>
                </Instrument>
            </Instruments>
        </Platform>
    </Platforms>
</Collection>`

describe('when applying instrument ECHO10 corrections', () => {
  test('should apply long name correction to first Instrument', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithInstruments,
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
    expect(result.correctedMetadata).toContain('<LongName>Updated Infrared Multispectral Scanner</LongName>')
    expect(result.correctedMetadata).not.toContain('<LongName>Infrared Multispectral Scanner</LongName>')

    // Other long name should remain unchanged
    expect(result.correctedMetadata).toContain('<LongName>Linear Imaging Self Scanning Sensor II</LongName>')

    // Platform stays untouched
    expect(result.correctedMetadata).toContain('<ShortName>UC-12B</ShortName>')
  })

  test('should update both short name and long name', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithInstruments,
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
    expect(result.correctedMetadata).toContain('<ShortName>LISSUPDATE-II</ShortName>')
    expect(result.correctedMetadata).not.toContain('<ShortName>LISS-II</ShortName>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<LongName>Linear Imaging Self Scanning Sensor II Updated</LongName>')
    expect(result.correctedMetadata).not.toContain('<LongName>Linear Imaging Self Scanning Sensor II</LongName>')
  })

  test('should delete Instrument', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithInstruments,
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
    expect(result.correctedMetadata).not.toContain('<ShortName>IRMSS</ShortName>')

    // Other Instrument should be unchanged
    expect(result.correctedMetadata).toContain('<ShortName>LISS-II</ShortName>')
  })

  test('should delete parent Instrument property when the last instrument in an array is removed', async () => {
    const multiInstrumentXml = `<Collection>
      <Platforms>
        <Platform>
          <ShortName>P1</ShortName>
            <Instruments>
              <Instrument><ShortName>I1</ShortName></Instrument>
              <Instrument><ShortName>I2</ShortName></Instrument>
            </Instruments>
        </Platform>
      </Platforms>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const singleInstrumentXml = `<Collection>
      <Platforms>
        <Platform>
          <ShortName>P1</ShortName>
            <Instruments>
              <Instrument>
                <ShortName>I1</ShortName>
              </Instrument>
            </Instruments>
        </Platform>
      </Platforms>  
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const instrumentXml = `<Collection>
      <Platforms>
        <Platform>
          <ShortName>P1</ShortName>
            <Instruments>
              <Instrument>
                <ShortName>OLD-SHORT</ShortName>
                <LongName>Old Long Name to delete</LongName>
              </Instrument>
            </Instruments>
        </Platform>
      </Platforms>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
          newLongName: '' // Triggers delete target['LongName']
        }
      ]
    })

    expect(result.correctionCount).toBe(1)
    expect(result.correctedMetadata).toContain('<ShortName>NEW-SHORT</ShortName>')
    expect(result.correctedMetadata).not.toContain('<LongName>')
  })

  test('should handle missing Instrument element', async () => {
    const xmlWithoutPlatform = `<Collection>
        <ShortName>No_instrument</ShortName>
        <Platforms>
          <Platform>
            <Type>Air-based Platforms</Type>
            <ShortName>UC-12B</ShortName>
            <LongName>NASA Langley Beechcraft UC-12B Huron</LongName>
          </Platform>
        </Platforms>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithInstruments,
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
    expect(result.correctedMetadata).toContain('<ShortName>IRMSS1</ShortName>')
  })
})

describe('when instrument guard clauses prevent a correction', () => {
  test('should return false when oldKeywordObject is missing', async () => {
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithInstruments,
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
    const xmlNoInstruments = '<Collection><ShortName>TEST</ShortName></Collection>'

    const result = await applyEcho10MetadataCorrections({
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
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithInstruments,
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
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithInstruments,
      corrections: [{
        scheme: 'instruments',
        action: 'invalid_action_type'
      }]
    })

    expect(result.correctionCount).toBe(0)
  })
})

const mockEcho10WithPlatforms = `<Collection>
    <ShortName>Platforms_Test</ShortName>
    <VersionId>001</VersionId>
      <Platforms>
        <Platform>
          <Type>Earth Observation Satellites</Type>
          <ShortName>SPOT-4</ShortName>
          <LongName>Systeme Observation de la Terre-4</LongName>
          <Instruments>
            <Instrument>
              <ShortName>VEGETATION-1</ShortName>
              <LongName>VEGETATION INSTRUMENT 1 (SPOT 4)</LongName>
            </Instrument>
          </Instruments>
        </Platform>
        <Platform>
          <Type>Earth Observation planes</Type>
          <ShortName>SPOT-5</ShortName>
          <LongName>Systeme Observation de la Terre-5</LongName>
          <Instruments>
            <Instrument>
              <ShortName>VEGETATION-2</ShortName>
              <LongName>VEGETATION INSTRUMENT 2 (SPOT 5)</LongName>
            </Instrument>
          </Instruments>
        </Platform>
    </Platforms>
</Collection>`

describe('when applying platform ECHO10 corrections', () => {
  test('should apply long name correction to first Platform', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithPlatforms,
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
    expect(result.correctedMetadata).toContain('<LongName>Systeme Observation de la Terre-4 Updated</LongName>')
    expect(result.correctedMetadata).not.toContain('<LongName>Systeme Observation de la Terre-4</LongName>')

    // Other Type should remain unchanged
    expect(result.correctedMetadata).toContain('<LongName>Systeme Observation de la Terre-5</LongName>')

    // Instrument stays untouched
    expect(result.correctedMetadata).toContain('<ShortName>VEGETATION-1</ShortName>')

    // Platform type untouched
    expect(result.correctedMetadata).toContain('<Type>Earth Observation Satellites</Type>')
  })

  test('should update both short name and long name', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithPlatforms,
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
    expect(result.correctedMetadata).toContain('<ShortName>SPOT-7-New</ShortName>')
    expect(result.correctedMetadata).not.toContain('<ShortName>SPOT-7</ShortName>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<LongName>Systeme Observation de la Terre-5 Updated</LongName>')
    expect(result.correctedMetadata).not.toContain('<LongName>Systeme Observation de la Terre-5</LongName>')

    expect(result.correctedMetadata).toContain('<Type>Earth Observation Satellites</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>Earth Observation planes</Type>')
  })

  test('should apply platform correction when there is only a single platform (object branch)', async () => {
    const singlePlatformXml = `<Collection>
      <ShortName>SINGLE_PLAT_TEST</ShortName>
      <VersionId>001</VersionId>
      <Platforms>
        <Platform>
            <Type>In Situ Land-based Platforms</Type>
            <ShortName>GROUND STATIONS</ShortName>
            <LongName>Long Name to be replaced</LongName>
        </Platform>
      </Platforms>
  </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).toContain('<ShortName>C-130</ShortName>')
    expect(result.correctedMetadata).toContain('<LongName>Lockheed C-130 Hercules</LongName>')
    expect(result.correctedMetadata).not.toContain('GROUND STATIONS')
  })

  test('should delete parent Platform property when the last platform in an array is removed', async () => {
    const multiPlatformXml = `<Collection>
      <Platforms>
        <Platform>
            <Type>Aircraft</Type>
            <ShortName>A1</ShortName>
        </Platform>
        <Platform>
            <Type>Aircraft</Type>
            <ShortName>A2</ShortName>
        </Platform>
      </Platforms>
  </Collection>`

    // Applying two deletions to empty the array and trigger the length === 0 check
    const result = await applyEcho10MetadataCorrections({
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
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithPlatforms,
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
    const platformOnlyXml = '<Collection><Platforms><Platform><ShortName>TEST</ShortName></Platform></Platforms></Collection>'

    const result = await applyEcho10MetadataCorrections({
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
    const singlePlatformXml = `<Collection>
      <ShortName>SINGLE_DELETE_TEST</ShortName>
      <Platforms>
        <Platform>
            <Type>Aircraft</Type>
            <ShortName>A1</ShortName>
        </Platform>
      </Platforms>
  </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const platformXml = `<Collection>
      <Platforms>
        <Platform>
            <Type>Aircraft</Type>
            <ShortName>OLD-SHORT</ShortName>
            <LongName>Old Long Name that should be deleted</LongName>
        </Platform>
      </Platforms>
  </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
          // Providing only one segment forces the LongName field to hit the 'else { delete }' branch
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

    // Verify ShortName was updated
    expect(result.correctedMetadata).toContain('<ShortName>NEW-SHORT</ShortName>')

    // Verify LongName was deleted (this is the branch we are covering)
    expect(result.correctedMetadata).not.toContain('<LongName>')
    expect(result.correctedMetadata).not.toContain('Old Long Name that should be deleted')
  })

  test('should handle missing Platform element', async () => {
    const xmlWithoutPlatform = `<Collection>
        <ShortName>NO_URL</ShortName>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithPlatforms,
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
    expect(result.correctedMetadata).toContain('<ShortName>SPOT-7</ShortName>')
  })
})

describe('when applying Dataformat ECHO10 corrections', () => {
  const mockEcho10WithDataFormat = `<Collection>
    <DataFormat>netCDF-4</DataFormat>
</Collection>`

  describe('when replacing DataFormat', () => {
    test('should successfully update the DataFormat with a new string', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithDataFormat,
        corrections: [{
          scheme: 'dataformat',
          action: 'replace',
          newKeywordObject: {
            Value: 'HDF4'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<DataFormat>HDF4</DataFormat>')
      expect(result.correctedMetadata).not.toContain('netCDF-4')
    })

    test('should default to replace action if no action is provided', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithDataFormat,
        corrections: [{
          scheme: 'dataformat',
          newKeywordObject: {
            Value: 'HDF5'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<DataFormat>HDF5</DataFormat>')
    })

    test('should return false and not modify the field if newKeywordObject is empty or invalid', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithDataFormat,
        corrections: [{
          scheme: 'dataformat',
          action: 'replace',
          newKeywordObject: {} // Empty spaces
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<DataFormat>netCDF-4</DataFormat>')
    })
  })

  describe('when deleting DataFormat', () => {
    test('should successfully delete the DataFormat key from the object', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithDataFormat,
        corrections: [{
          scheme: 'dataFormat',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<DataFormat>')
    })

    test('should return false if trying to delete a DataFormat that does not exist', async () => {
      const missingFieldXml = '<Collection><ShortName>TEST</ShortName></Collection>'
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: missingFieldXml,
        corrections: [{
          scheme: 'dataformat',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })
  })

  describe('when handling DataFormat edge cases', () => {
    test('should return empty count if metadataPayload is null or undefined', async () => {
      const resultNull = await applyEcho10MetadataCorrections({
        metadataPayload: null,
        corrections: [{
          scheme: 'dataformat',
          action: 'replace',
          newKeywordObject: {
            Value: 'hdf6'
          }
        }]
      })

      expect(resultNull.correctionCount).toBe(0)
      expect(resultNull.stubbed).toBe(true)
    })

    test('should return false if parsedMetadata does not contain a ECHO object', async () => {
      const malformedXml = '<NOT_Collection><DataFormat>NetCDF-4</DataFormat></NOT_Collection>'
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: malformedXml,
        corrections: [{
          scheme: 'dataformat',
          action: 'replace',
          newKeywordObject: {
            Value: 'HDF4'
          }
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return true and add a new node if the DataFormat is not present', async () => {
      const noProcessingLevelXml = '<Collection></Collection>'
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: noProcessingLevelXml,
        corrections: [{
          scheme: 'dataformat',
          action: 'replace',
          newKeywordObject: {
            Value: 'HDF5'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)

      expect(result.correctedMetadata).toContain('<DataFormat>HDF5</DataFormat>')
    })

    test('should return false if an unknown action type is provided', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithDataFormat,
        corrections: [{
          scheme: 'dataformat',
          action: 'invalid_action_type',
          newKeywordObject: {
            Value: 'HDF2'
          }
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<DataFormat>netCDF-4</DataFormat>')
    })
  })
})

describe('when applying ProcessingLevelId ECHO10 corrections', () => {
  const mockEcho10WithProductLevel = `<Collection>
    <ProcessingLevelId>Level 1B</ProcessingLevelId>
</Collection>`

  describe('when replacing ProcessingLevelId', () => {
    test('should successfully update the ProcessingLevelId with a new string', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordObject: {
            Value: 'Level 2'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<ProcessingLevelId>Level 2</ProcessingLevelId>')
      expect(result.correctedMetadata).not.toContain('Level 1B')
    })

    test('should default to replace action if no action is provided', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          newKeywordObject: {
            Value: 'Level 3'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).toContain('<ProcessingLevelId>Level 3</ProcessingLevelId>')
    })

    test('should return false and not modify the field if newKeywordObject is empty or invalid', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordObject: {} // Empty spaces
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<ProcessingLevelId>Level 1B</ProcessingLevelId>')
    })
  })

  describe('when deleting ProcessingLevelId', () => {
    test('should successfully delete the ProcessingLevelId key from the object', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(1)
      expect(result.correctedMetadata).not.toContain('<ProcessingLevelId>')
    })

    test('should return false if trying to delete a ProcessingLevelId that does not exist', async () => {
      const missingFieldXml = '<Collection><ShortName>TEST</ShortName></Collection>'
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: missingFieldXml,
        corrections: [{
          scheme: 'productlevelid',
          action: 'delete'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })
  })

  describe('when handling ProcessingLevelId edge cases', () => {
    test('should return empty count if metadataPayload is null or undefined', async () => {
      const resultNull = await applyEcho10MetadataCorrections({
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

    test('should return false if parsedMetadata does not contain a ECHO object', async () => {
      const malformedXml = '<NOT_Collection><ProcessingLevelId>Level 1B</ProcessingLevelId></NOT_Collection>'
      const result = await applyEcho10MetadataCorrections({
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

    test('should return true and add a new node if the ProcessingLevelId is not present', async () => {
      const noProcessingLevelXml = '<Collection></Collection>'
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: noProcessingLevelXml,
        corrections: [{
          scheme: 'productlevelid',
          action: 'replace',
          newKeywordObject: {
            Value: 'Level 4'
          }
        }]
      })

      expect(result.correctionCount).toBe(1)

      expect(result.correctedMetadata).toContain('<ProcessingLevelId>Level 4</ProcessingLevelId>')
    })

    test('should return false if an unknown action type is provided', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProductLevel,
        corrections: [{
          scheme: 'productlevelid',
          action: 'invalid_action_type',
          newKeywordObject: {
            Value: 'Level 2'
          }
        }]
      })

      expect(result.correctionCount).toBe(0)
      expect(result.correctedMetadata).toContain('<ProcessingLevelId>Level 1B</ProcessingLevelId>')
    })
  })
})

const mockEcho10WithProjects = `<Collection>
    <ShortName>Projects_Test</ShortName>
    <VersionId>001</VersionId>
    <Campaigns>
        <Campaign>
            <ShortName>ESIP</ShortName>
            <LongName>Earth Science Information Partners Program</LongName>
        </Campaign>
        <Campaign>
            <ShortName>ALIENS</ShortName>
            <LongName>Aliens in Antarctica</LongName>
        </Campaign>
    </Campaigns>
</Collection>`

describe('when applying project ECHO10 corrections', () => {
  test('should apply long name correction to first Project', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProjects,
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
    expect(result.correctedMetadata).toContain('<LongName>Updated Earth Science Information Partners Program</LongName>')
    expect(result.correctedMetadata).not.toContain('<LongName>Earth Science Information Partners Program</LongName>')

    // Second long name stays untouched
    expect(result.correctedMetadata).toContain('<LongName>Aliens in Antarctica</LongName>')
  })

  test('should update both short name and long name', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProjects,
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
    expect(result.correctedMetadata).toContain('<ShortName>ALIENS UP</ShortName>')
    expect(result.correctedMetadata).not.toContain('<ShortName>ALIENS</ShortName>')

    // Verify long name was updated
    expect(result.correctedMetadata).toContain('<LongName>Aliens research in Antarctica</LongName>')
    expect(result.correctedMetadata).not.toContain('<LongName>Aliens in Antarctica</LongName>')
  })

  test('should delete Project', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProjects,
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
    expect(result.correctedMetadata).not.toContain('<ShortName>ESIP</ShortName>')

    // Other Project should be unchanged
    expect(result.correctedMetadata).toContain('<ShortName>ALIENS</ShortName>')
  })

  test('should delete the Project key when the last element of an array is removed', async () => {
    // Starting with an array of two projects (from mockEcho10WithProjects)
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithProjects,
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
    const singleProjectXml = `<Collection>
        <Campaigns>
            <Campaign>
                <ShortName>SINGLE-PROJ</ShortName>
                <LongName>Single Project Test</LongName>
            </Campaign>
        </Campaigns>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const singleProjectXml = `<Collection>
        <Campaigns>
          <Campaign>
              <ShortName>SINGLE-PROJ</ShortName>
              <LongName>Single Project Test</LongName>
          </Campaign>
        </Campaigns>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).not.toContain('<Campaign>')
    expect(result.correctedMetadata).not.toContain('SINGLE-PROJ')
  })

  test('should handle missing Project element', async () => {
    const xmlWithoutProject = `<Collection>
        <ShortName>No_project</ShortName>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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

  test('should delete a specific field (LongName) within a Project when the new value is undefined', async () => {
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithProjects,
      corrections: [
        {
          scheme: 'projects',
          action: 'replace',
          oldKeywordObject: {
            Category: 'D - F',
            ShortName: 'ESIP'
          },
          // Providing a single segment and NO newLongName
          // results in normalizedSegments[1] (LongName) being undefined
          newKeywordObject: {
            Category: 'M - O',
            ShortName: 'ONLY_SHORT'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // 1. Verify ShortName was updated
    expect(result.correctedMetadata).toContain('<ShortName>ONLY_SHORT</ShortName>')

    // 2. Verify the OLD LongName for Project 0 is gone
    expect(result.correctedMetadata).not.toContain('Earth Science Information Partners Program')

    // 3. Verify that Project 1 still HAS its LongName (proving we didn't delete everything)
    expect(result.correctedMetadata).toContain('<LongName>Aliens in Antarctica</LongName>')
  })

  test('should match by old keyword path even when a stale ummPath is present', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProjects,
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
    expect(result.correctedMetadata).toContain('<ShortName>ESIP-7</ShortName>')
  })

  describe('when guard clauses prevent a correction', () => {
    test('should return false if oldKeywordObject is missing', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProjects,
        corrections: [{
          scheme: 'projects'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return false if Project tag is missing from metadata', async () => {
      const xmlWithoutProject = '<Collection><ShortName>TEST</ShortName></Collection>'
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: xmlWithoutProject,
        corrections: [{
          scheme: 'projects'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })

    test('should return false if the current project path cannot be matched', async () => {
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProjects,
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
      const result = await applyEcho10MetadataCorrections({
        metadataPayload: mockEcho10WithProjects,
        corrections: [{
          scheme: 'projects',
          action: 'invalid_action'
        }]
      })

      expect(result.correctionCount).toBe(0)
    })
  })
})

const mockEcho10WithProviders = `<Collection>
    <ShortName>Providers_Test</ShortName>
    <VersionId>001</VersionId>
    <Contacts>
        <Contact>
            <Role>PROCESSOR</Role>
            <OrganizationName>NASA/MSFC/AMSR-E SIPS</OrganizationName>
        </Contact>
        <Contact>
            <Role>ARCHIVER</Role>
            <OrganizationName>NSIDC</OrganizationName>
        </Contact>
        <Contact>
            <Role>ACADEMIC</Role>
            <OrganizationName>BROWN/GEO</OrganizationName>
            <HoursOfService>0800-1600</HoursOfService>
            <Instructions>In addition to the address below there are other ESIC offices throught the country. Afull list of these offices is at:&lt;URL: http://www-nmd.usgs.gov/esic/esic_index.html&gt;</Instructions>
            <ContactPersons>
                <ContactPerson>
                    <FirstName>Customer</FirstName>
                    <MiddleName>Services</MiddleName>
                    <LastName>Representative</LastName>
                    <JobPosition>DATA CENTER CONTACT</JobPosition>
                </ContactPerson>
            </ContactPersons>
        </Contact>
        <Contact>
            <Role>COMMERCIAL</Role>
            <OrganizationName>ESRI-CANADA</OrganizationName>
            <HoursOfService>0800-1630</HoursOfService>
            <Instructions>In addition to the address below there are other ESIC offices throught the country. Afull list of these offices is at:&lt;URL: http://www-nmd.usgs.gov/esic/esic_index.html&gt;</Instructions>
            <ContactPersons>
                <ContactPerson>
                    <LastName>Not provided</LastName>
                    <JobPosition>DATA CENTER CONTACT</JobPosition>
                </ContactPerson>
            </ContactPersons>
        </Contact>
    </Contacts>
    <ProcessingCenter>NASA/MSFC/AMSR-E SIPS</ProcessingCenter>
    <ArchiveCenter>NSIDC</ArchiveCenter>
</Collection>`

describe('when applying provider ECHO10 corrections', () => {
  test('should update the short name for COMMERCIAL only', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProviders,
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
    expect(result.correctedMetadata).toContain('<OrganizationName>ESRI2-CANADA</OrganizationName>')
    expect(result.correctedMetadata).not.toContain('<OrganizationName>ESRI-CANADA</OrganizationName>')

    // Verify ProcesssingCenter and ArchiveCenter were not updated
    expect(result.correctedMetadata).toContain('<ProcessingCenter>NASA/MSFC/AMSR-E SIPS</ProcessingCenter>')
    expect(result.correctedMetadata).toContain('<ArchiveCenter>NSIDC</ArchiveCenter>')
  })

  test('should update the short name for PROCESSOR and ProcessingCenter', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            BucketLevel0: 'PROCESSOR',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NASA/MSFC/AMSR-E SIPS'
          },
          newKeywordObject: {
            BucketLevel0: 'PROCESSOR',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NASA/MSFC/AMSR-E SIPS-UPDATED'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<OrganizationName>NASA/MSFC/AMSR-E SIPS-UPDATED</OrganizationName>')
    expect(result.correctedMetadata).not.toContain('<OrganizationName>NASA/MSFC/AMSR-E SIPS</OrganizationName>')

    // Verify ProcesssingCenter and ArchiveCenter were not updated
    expect(result.correctedMetadata).toContain('<ProcessingCenter>NASA/MSFC/AMSR-E SIPS-UPDATED</ProcessingCenter>')
    expect(result.correctedMetadata).toContain('<ArchiveCenter>NSIDC</ArchiveCenter>')
  })

  test('should update the short name for ARCHIVER and ArchiveCenter', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProviders,
      corrections: [
        {
          scheme: 'providers',
          action: 'replace',
          oldKeywordObject: {
            BucketLevel0: 'ARCHIVER',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NSIDC'
          },
          newKeywordObject: {
            BucketLevel0: 'ARCHIVER',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NSIDC-UPDATED'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(1)

    // Verify short name was updated
    expect(result.correctedMetadata).toContain('<OrganizationName>NSIDC-UPDATED</OrganizationName>')
    expect(result.correctedMetadata).not.toContain('<OrganizationName>NSIDC</OrganizationName>')

    // Verify ProcesssingCenter and ArchiveCenter were not updated
    expect(result.correctedMetadata).toContain('<ProcessingCenter>NASA/MSFC/AMSR-E SIPS</ProcessingCenter>')
    expect(result.correctedMetadata).toContain('<ArchiveCenter>NSIDC-UPDATED</ArchiveCenter>')
  })

  test('should delete Provider', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProviders,
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
    expect(result.correctedMetadata).toContain('<OrganizationName>BROWN/GEO</OrganizationName>')
  })

  test('should handle missing Provider element', async () => {
    const xmlWithoutProvider = `<Collection>
        <Entry_ID>
            <ShortName>No_instrument</ShortName>
        </Entry_ID>
        <Platform>
          <Type>Air-based Platforms</Type>
          <ShortName>UC-12B</ShortName>
          <LongName>NASA Langley Beechcraft UC-12B Huron</LongName>
        </Platform>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithProviders,
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
    expect(result.correctedMetadata).toContain('<OrganizationName>ESRI2-CANADA</OrganizationName>')
  })

  test('should return false when the current provider path cannot be matched', async () => {
    // Organization block without the Organization_Name child
    const missingNameXml = `<Collection>
        <Organization>
            <Organization_Type>ARCHIVER</Organization_Type>
        </Organization>
      </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).not.toContain('<OrganizationName>SHORT</OrganizationName>')
  })

  test('should remove the Contacts key entirely when the last provider in an array is deleted', async () => {
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithProviders,
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
        },
        {
          scheme: 'providers',
          action: 'delete',
          oldKeywordObject: {
            BucketLevel0: 'ARCHIVER',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NSIDC'
          }
        },
        {
          scheme: 'providers',
          action: 'delete',
          oldKeywordObject: {
            BucketLevel0: 'PROCESSOR',
            BucketLevel1: '',
            BucketLevel2: '',
            BucketLevel3: '',
            ShortName: 'NASA/MSFC/AMSR-E SIPS'
          }
        }
      ]
    })

    expect(result.correctionCount).toBe(4)
    // This triggers: if (parent.Organization.length === 0) { delete parent.Organization }
    expect(result.correctedMetadata).not.toContain('<Contacts>')
  })

  test('should delete the Contacts key when it contains a single object instead of an array', async () => {
    const singleOrgXml = '<Collection><Contacts><Contact><Role>ORG</Role><OrganizationName>O</OrganizationName></Contact></Contacts></Collection>'
    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).not.toContain('<Contacts>')
  })

  test('should remove a specific provider field when the replacement value is empty or undefined', async () => {
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithProviders,
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
        // Providing only one segment and no newLongName should prune the existing LongName field.
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
    expect(result.correctedMetadata).toContain('<OrganizationName>ONLY_SHORT</OrganizationName>')
  })

  test('should return false and make no changes when an unsupported action is provided', async () => {
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithProviders,
      corrections: [{
        scheme: 'providers',
        action: 'invalid_action'
      }]
    })

    // This triggers the final: return false
    expect(result.correctionCount).toBe(0)
  })
})

const mockEcho10WithRelatedURLs = `<Collection>
    <ShortName>RELATED_URL_TEST</ShortName>
    <VersionId>001</VersionId>
    <OnlineResources>
        <OnlineResource>
            <URL>https://example.com/data</URL>
            <Type>DistributionURL : GET DATA</Type>
        </OnlineResource>
        <OnlineResource>
            <URL>https://example.org/opensearch</URL>
            <Description>OpenSearch endpoint</Description>
            <Type>DistributionURL : GET CAPABILITIES : OpenSearch</Type>
        </OnlineResource>
        <OnlineResource>
            <URL>https://example.org/api</URL>
            <Type>DistributionURL : USE SERVICE API : REST</Type>
        </OnlineResource>
    </OnlineResources>
</Collection>`

describe('when applying related URL content type ECHO10 corrections', () => {
  test('should apply URL content type correction to first Related_URL', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithRelatedURLs,
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
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : GET SERVICE</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>DistributionURL : GET DATA</Type>')

    // Other URLs should remain unchanged
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : GET CAPABILITIES : OpenSearch</Type>')
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : USE SERVICE API : REST</Type>')
  })

  test('should update both type and subtype and append to URLContentType', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithRelatedURLs,
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

    // Verify type was updated
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : GET CAPABILITIES : OGC WMS</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>DistributionURL : GET CAPABILITIES : OpenSearch</Type>')
  })

  test('should append subtype to URL that only had type', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithRelatedURLs,
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

    expect(result.correctedMetadata).toContain('<Type>DistributionURL : GET DATA : DIRECT DOWNLOAD</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>DistributionURL : GET DATA</Type>')
  })

  test('should remove subtype when moving to type-only', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithRelatedURLs,
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
    const getDataMatches = result.correctedMetadata.match(/<Type>DistributionURL : GET DATA<\/Type>/g)
    expect(getDataMatches.length).toBeGreaterThan(0)

    // REST subtype should be removed from third URL
    expect(result.correctedMetadata).not.toContain('<Type>DistributionURL : USE SERVICE API : REST</Type>')
  })

  test('should delete URL_Content_Type from Related_URL', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithRelatedURLs,
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

    // The Related_URL itself should be removed too
    expect(result.correctedMetadata).not.toContain('https://example.com/opensearch')

    // Other Related_URLs should be unchanged
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : GET DATA</Type>')
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : USE SERVICE API : REST</Type>')
  })

  test('should handle single Related_URL (not array)', async () => {
    const singleUrlXml = `<Collection>
    <ShortName>SINGLE_URL</ShortName>
    <OnlineResources>
        <OnlineResource>
            <URL>https://example.com</URL>
            <Type>DistributionURL : VIEW PROJECT HOME PAGE</Type>
        </OnlineResource>
    </OnlineResources>
</Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : VIEW RELATED INFORMATION</Type>')
    expect(result.correctedMetadata).not.toContain('VIEW PROJECT HOME PAGE')
  })

  test('should handle missing Related_URL element', async () => {
    const xmlWithoutRelatedURL = `<Collection>
    <ShortName>NO_URL</ShortName>
</Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithRelatedURLs,
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

    // 2. Verify the specific OLD Type is gone
    expect(result.correctedMetadata).not.toContain('<Type>DistributionURL : GET CAPABILITIES : OpenSearch</Type>')

    // 3. Verify that other Subtypes in different blocks are UNTOUCHED
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : GET DATA</Type>')
    expect(result.correctedMetadata).toContain('<Type>DistributionURL : USE SERVICE API : REST</Type>')
  })

  test('should return false and make no changes when an unsupported action is provided', async () => {
    const result = await applyEcho10MetadataCorrections({
      metadataPayload: mockEcho10WithRelatedURLs,
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

  test('should return false when oldKeywordObject does not match any current elements', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10WithRelatedURLs,
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
    const xmlWithAttributes = `<Collection>
        <OnlineResources>
            <OnlineResource>
                <URL>https://example.com/data</URL>
                <Type>GET DATA</Type>
            </OnlineResource>
        </OnlineResources>
    </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).toContain('<Type>GET SERVICE</Type>')
    expect(result.correctedMetadata).not.toContain('<Type>GET DATA</Type>')
  })
})

const mockEcho10Xml = `<Collection>
    <ShortName>DEM_100M</ShortName>
    <VersionId>001</VersionId>
    <ScienceKeywords>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>LAND SURFACE</TopicKeyword>
            <TermKeyword>TOPOGRAPHY</TermKeyword>
            <VariableLevel1Keyword>
                <Value>LANDFORMS</Value>
                <VariableLevel2Keyword>
                    <Value>DEM</Value>
                </VariableLevel2Keyword>
            </VariableLevel1Keyword>
        </ScienceKeyword>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>LAND SURFACE</TopicKeyword>
            <TermKeyword>TOPOGRAPHY</TermKeyword>
            <VariableLevel1Keyword>
                <Value>TERRAIN ELEVATION</Value>
                <VariableLevel2Keyword>
                    <Value>DIGITAL TERRAIN MODEL</Value>
                </VariableLevel2Keyword>
            </VariableLevel1Keyword>
        </ScienceKeyword>
    </ScienceKeywords>
    <Platforms>
        <Platform>
            <ShortName>Not provided</ShortName>
            <Type>Not provided</Type>
        </Platform>
    </Platforms>
</Collection>`

const mockSimpleEcho10Xml = `<Collection>
    <ShortName>TEST_COLLECTION</ShortName>
    <ScienceKeywords>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>ATMOSPHERE</TopicKeyword>
            <TermKeyword>AEROSOLS</TermKeyword>
            <VariableLevel1Keyword>
                <Value>LEGACY AEROSOLS</Value>
            </VariableLevel1Keyword>
        </ScienceKeyword>
    </ScienceKeywords>
</Collection>`

describe('when applying science keyword ECHO10 corrections', () => {
  test('should apply science keyword renaming correction (same hierarchy, different name)', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleEcho10Xml,
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
    expect(result.correctedMetadata).toContain('<CategoryKeyword>EARTH SCIENCE</CategoryKeyword>')
    expect(result.correctedMetadata).toContain('<TopicKeyword>ATMOSPHERE</TopicKeyword>')
    expect(result.correctedMetadata).toContain('<TermKeyword>AEROSOLS</TermKeyword>')
    expect(result.correctedMetadata).toContain('<Value>AEROSOLS RENAMED</Value>')
    // Old name should be gone
    expect(result.correctedMetadata).not.toContain('LEGACY AEROSOLS')
  })

  test('should apply science keyword hierarchy move (same name, different topic)', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleEcho10Xml,
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
    expect(result.correctedMetadata).toContain('<CategoryKeyword>EARTH SCIENCE</CategoryKeyword>')
    expect(result.correctedMetadata).toContain('<TopicKeyword>AIR QUALITY</TopicKeyword>')
    expect(result.correctedMetadata).toContain('<TermKeyword>AEROSOLS</TermKeyword>')
    expect(result.correctedMetadata).toContain('<Value>LEGACY AEROSOLS</Value>')
    // Old topic should be gone
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('should apply hierarchy move with renaming at same level', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10Xml,
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
    expect(result.correctedMetadata).toContain('<CategoryKeyword>EARTH SCIENCE</CategoryKeyword>')
    expect(result.correctedMetadata).toContain('<TopicKeyword>LAND SURFACE</TopicKeyword>')
    expect(result.correctedMetadata).toContain('<TermKeyword>ELEVATION</TermKeyword>')
    expect(result.correctedMetadata).toContain('<Value>TERRAIN FEATURES</Value>')
    expect(result.correctedMetadata).toContain('<Value>DIGITAL ELEVATION MODEL</Value>')

    // Old values should be gone from first keyword (second keyword still has TOPOGRAPHY)
    const topographyMatches = result.correctedMetadata.match(/<TermKeyword>TOPOGRAPHY<\/TermKeyword>/g)
    expect(topographyMatches).toHaveLength(1) // Only in second keyword
    expect(result.correctedMetadata).not.toContain('LANDFORMS')
  })

  test('should apply correction to second keyword in array', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10Xml,
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
    expect(result.correctedMetadata).toContain('<Value>DEM</Value>')

    // Second keyword should be updated with new names
    expect(result.correctedMetadata).toContain('<Value>ELEVATION DATA</Value>')
    expect(result.correctedMetadata).toContain('<Value>DIGITAL ELEVATION DATA</Value>')
    // Old values should be gone
    expect(result.correctedMetadata).not.toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('should remove science keyword when delete action is applied', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10Xml,
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
    expect(result.correctedMetadata).not.toContain('<Value>DEM</Value>')

    // Second keyword should remain
    expect(result.correctedMetadata).toContain('TERRAIN ELEVATION')
    expect(result.correctedMetadata).toContain('DIGITAL TERRAIN MODEL')
  })

  test('should remove second science keyword when delete action is applied', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10Xml,
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
    const multiKeywordXml = `<Collection>
    <ScienceKeywords>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>ATMOSPHERE</TopicKeyword>
            <TermKeyword>AEROSOLS</TermKeyword>
        </ScienceKeyword>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>OCEANS</TopicKeyword>
            <TermKeyword>MARINE SEDIMENTS</TermKeyword>
        </ScienceKeyword>
    </ScienceKeywords>
  </Collection>`

    // Since lookups are by path format value string, we specify the exact old keyword path values
    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).not.toContain('<ScienceKeywords>')
    expect(result.correctedMetadata).not.toContain('</ScienceKeywords>')
  })

  test('should return false when an unsupported action is provided', async () => {
    const singleScienceKeywordXml = `<Collection>
      <ScienceKeywords>
          <ScienceKeyword>
              <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
              <TopicKeyword>ATMOSPHERE</TopicKeyword>
              <TermKeyword>AEROSOLS</TermKeyword>
          </ScienceKeyword>
      </ScienceKeywords>
  </Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10Xml,
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
    expect(result.correctedMetadata).toContain('<Value>DIGITAL ELEVATION MODEL</Value>')

    // Second keyword: moved to completely different hierarchy
    expect(result.correctedMetadata).toContain('TERRESTRIAL HYDROSPHERE')
    expect(result.correctedMetadata).toContain('SURFACE WATER')
    expect(result.correctedMetadata).toContain('<Value>DTM</Value')
    expect(result.correctedMetadata).not.toContain('DIGITAL TERRAIN MODEL')
  })

  test('should apply term-level rename within same category and topic', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10Xml,
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
    expect(result.correctedMetadata).toContain('<TermKeyword>SURFACE TOPOGRAPHY</TermKeyword>')
    expect(result.correctedMetadata).toContain('LANDFORMS')
    expect(result.correctedMetadata).toContain('DEM')

    // Old term should still exist in second keyword
    const topographyMatches = result.correctedMetadata.match(/<TermKeyword>TOPOGRAPHY<\/TermKeyword>/g)
    expect(topographyMatches).toHaveLength(1) // Only in second keyword
  })

  test('should apply category-level change (moving keyword to different category)', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleEcho10Xml,
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
    expect(result.correctedMetadata).toContain('<CategoryKeyword>EARTH SCIENCE SERVICES</CategoryKeyword>')
    expect(result.correctedMetadata).toContain('<TopicKeyword>DATA ANALYSIS AND VISUALIZATION</TopicKeyword>')
    expect(result.correctedMetadata).toContain('<TermKeyword>AEROSOL ANALYSIS</TermKeyword>')
    expect(result.correctedMetadata).toContain('<Value>LEGACY AEROSOLS</Value>')

    // Old category should be gone
    expect(result.correctedMetadata).not.toContain('<CategoryKeyword>EARTH SCIENCE</CategoryKeyword>')
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('should handle single science keyword (not array) with replacement', async () => {
    const singleKeywordXml = `<Collection>
    <ShortName>SINGLE_KEYWORD</ShortName>
    <ScienceKeywords>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>ATMOSPHERE</TopicKeyword>
            <TermKeyword>CLOUDS</TermKeyword>
        </ScienceKeyword>
    </ScienceKeywords>
</Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).not.toContain('<TermKeyword>CLOUDS</TermKeyword>')
  })

  test('should delete only science keyword and removes Science_Keywords element', async () => {
    const singleKeywordXml = `<Collection>
    <ShortName>DELETE_ONLY_KEYWORD</ShortName>
    <ScienceKeywords>
        <ScienceKeyword>
            <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
            <TopicKeyword>ATMOSPHERE</TopicKeyword>
        </ScienceKeyword>
    </ScienceKeywords>
</Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    expect(result.correctedMetadata).not.toContain('ScienceKeywords')
    expect(result.correctedMetadata).not.toContain('ATMOSPHERE')
  })

  test('should handle multiple deletes reducing array to single element', async () => {
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockEcho10Xml,
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
    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: mockSimpleEcho10Xml,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          // This path does not exist in mockSimpleEcho10Xml, so lookup fails
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
    const xmlWithoutKeywords = `<Collection>
    <ShortName>NO_KEYWORDS</ShortName>
</Collection>`

    const result = await applyEcho10MetadataCorrections({
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
    const xmlWithComplexNodes = `<Collection>
      <ShortName>COMPLEX_LEAF_TEST</ShortName>
      <ScienceKeywords>
          <ScienceKeyword>
              <CategoryKeyword>EARTH SCIENCE</CategoryKeyword>
              <TopicKeyword>ATMOSPHERE</TopicKeyword>
              <TermKeyword>CLOUDS</TermKeyword>
          </ScienceKeyword>
      </ScienceKeywords>
  </Collection>`

    const result = await applyEcho10MetadataCorrections({
      collectionConceptId: 'C1',
      providerId: 'PROV',
      nativeId: 'native-1',
      metadataPayload: xmlWithComplexNodes,
      corrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace',
          ummPath: ['Science_Keywords', 0],
          // This should match despite <CategoryKeyword> being parsed as an object internally
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
    expect(result.correctedMetadata).toContain('<TermKeyword>CLOUD PROPERTIES</TermKeyword>')
    expect(result.correctedMetadata).not.toContain('<TermKeyword>CLOUDS</TermKeyword>')
  })
})
