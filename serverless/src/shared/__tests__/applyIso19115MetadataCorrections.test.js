import {
  describe,
  expect,
  test
} from 'vitest'

import applyIso19115MetadataCorrections from '../applyIso19115MetadataCorrections'
import { ISO_19115_SCHEME_EDITORS } from '../Iso19115DomEditor'
import Iso19115MetadataPathEditor from '../Iso19115MetadataPathEditor'

const mockIso19115 = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos" 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi" 
  xmlns:gml="http://www.opengis.net/gml/3.2" 
  xmlns:gmx="http://www.isotc211.org/2005/gmx"
  xmlns:xlink="http://www.w3.org/1999/xlink" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:topicCategory>
        <gmd:MD_TopicCategoryCode codeListValue="LOCATION">LOCATION</gmd:MD_TopicCategoryCode>
      </gmd:topicCategory>
      <gmd:topicCategory>
        <gmd:MD_TopicCategoryCode codeListValue="FARMING">FARMING</gmd:MD_TopicCategoryCode>
      </gmd:topicCategory>
      <gmd:topicCategory>
        <gmd:MD_TopicCategoryCode codeListValue="ELEVATION">ELEVATION</gmd:MD_TopicCategoryCode>
      </gmd:topicCategory>
      <gmd:processingLevel>
        <gmd:MD_Identifier>
          <gmd:code>
            <gco:CharacterString>3</gco:CharacterString>
          </gmd:code>
          <gmd:codeSpace>
            <gco:CharacterString>gov.nasa.esdis.umm.processinglevelid</gco:CharacterString>
          </gmd:codeSpace>
        </gmd:MD_Identifier>
      </gmd:processingLevel>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gmx:Anchor xlink:href="https://gcmdservices.gsfc.nasa.gov/kms/concept/086c68e5-1c94-4f2f-89d5-0453443ff249" xlink:actuate="onRequest">DOC/NOAA/NESDIS/NODC &gt; National Oceanographic Data Center, NESDIS, NOAA, U.S. Department of Commerce</gmx:Anchor>
          </gmd:keyword>
          <gmd:keyword>
            <gmx:Anchor xlink:href="https://gcmdservices.gsfc.nasa.gov/kms/concept/e59896e0-3b4d-43ea-9348-f1f456305d05" xlink:actuate="onRequest">DOC/NOAA/NESDIS/NCEI &gt; National Centers for Environmental Information, NESDIS, NOAA, U.S. Department of Commerce</gmx:Anchor>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="dataCentre">dataCentre</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>Global Change Master Directory (GCMD) Data Center Keywords</gco:CharacterString>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2019-11-12</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="publication">publication</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
              <gmd:edition>
                <gco:CharacterString>9</gco:CharacterString>
              </gmd:edition>
              <gmd:citedResponsibleParty>
                <gmd:CI_ResponsibleParty>
                  <gmd:organisationName>
                    <gco:CharacterString>DOC/NOAA/NESDIS/NCEI &gt; National Centers for Environmental Information, NESDIS, NOAA, U.S. Department of Commerce</gco:CharacterString>
                  </gmd:organisationName>
                  <gmd:contactInfo>
                    <gmd:CI_Contact>
                      <gmd:address>
                        <gmd:CI_Address>
                          <gmd:city>
                            <gco:CharacterString>Greenbelt</gco:CharacterString>
                          </gmd:city>
                          <gmd:administrativeArea>
                            <gco:CharacterString>MD</gco:CharacterString>
                          </gmd:administrativeArea>
                        </gmd:CI_Address>
                      </gmd:address>
                      <gmd:onlineResource>
                        <gmd:CI_OnlineResource>
                          <gmd:linkage>
                            <gmd:URL>https://wiki.earthdata.nasa.gov/display/gcmdkey</gmd:URL>
                          </gmd:linkage>
                          <gmd:protocol>
                            <gco:CharacterString>HTTPS</gco:CharacterString>
                          </gmd:protocol>
                          <gmd:name>
                            <gco:CharacterString>GCMD Keyword Forum Page</gco:CharacterString>
                          </gmd:name>
                          <gmd:description>
                            <gco:CharacterString>The information provided on this page seeks to define how the GCMD Keywords are structured, used and accessed. It also provides information on how users can participate in the further development of the keywords.</gco:CharacterString>
                          </gmd:description>
                          <gmd:function>
                            <gmd:CI_OnLineFunctionCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="information">information</gmd:CI_OnLineFunctionCode>
                          </gmd:function>
                        </gmd:CI_OnlineResource>
                      </gmd:onlineResource>
                    </gmd:CI_Contact>
                  </gmd:contactInfo>
                  <gmd:role>
                    <gmd:CI_RoleCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="custodian">custodian</gmd:CI_RoleCode>
                  </gmd:role>
                </gmd:CI_ResponsibleParty>
              </gmd:citedResponsibleParty>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>   
          <gmd:keyword>
            <gco:CharacterString>EARTH SCIENCE &gt; Cryosphere &gt; Glaciers/Ice Sheets &gt; Firn &gt; Snow Grain Size</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>EARTH SCIENCE &gt; ATMOSPHERE &gt; AEROSOLS</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>EARTH SCIENCE &gt; Cryosphere &gt; Glaciers/Ice Sheets &gt; Glacier Topography/Ice Sheet Topography &gt; Surface Morphology</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>EARTH SCIENCE &gt; Cryosphere &gt; Glaciers/Ice Sheets &gt; Glacier Topography/Ice Sheet Topography &gt; Surface Morphology</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>NASA / GCMD Science Keywords</gco:CharacterString>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2008-02-05</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="revision">revision</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>TERRA &gt; Earth Observing System, TERRA (AM-1)</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>AQUA &gt; Earth Observing System</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>NASA / GCMD Platform Keywords</gco:CharacterString>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2016-06-10</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="revision">revision</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
            <gmd:keyword>
            <gco:CharacterString>ATLAS &gt; Advanced Topographic Laser Altimeter System</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>MODIS &gt; Moderate-Resolution Imaging Spectroradiometer</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="instrument">instrument</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>NASA / GCMD Instrument Keywords</gco:CharacterString>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2016-06-01</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="revision">revision</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>MEASURES &gt; Making Earth System Data Records for Use in Research Environments</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>MAGIA &gt; Structure, Stratigraphy, and Sedimentology North of the Antarctic Peninsula</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="project">project</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>NASA / GCMD Project Keywords</gco:CharacterString>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2008-01-24</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="revision">revision</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>Continent &gt; North America &gt; Greenland</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>Continent &gt; North America &gt; Canada &gt; Alberta</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="place">place</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>NASA / GCMD Location Keywords</gco:CharacterString>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2008-02-05</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="revision">revision</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmd:contentInfo>
    <gmd:MD_ImageDescription>
      <gmd:processingLevelCode>
        <gmd:MD_Identifier>
          <gmd:code>
            <gco:CharacterString>3</gco:CharacterString>
          </gmd:code>
          <gmd:codeSpace>
            <gco:CharacterString>gov.nasa.esdis.umm.processinglevelid</gco:CharacterString>
          </gmd:codeSpace>
        </gmd:MD_Identifier>
      </gmd:processingLevelCode>
    </gmd:MD_ImageDescription>
  </gmd:contentInfo>
</gmi:MI_Metadata>`

const mockIso19115WithOneScienceKeyword = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos" 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi" 
  xmlns:gml="http://www.opengis.net/gml/3.2" 
  xmlns:xlink="http://www.w3.org/1999/xlink" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>EARTH SCIENCE &gt; ATMOSPHERE &gt; AEROSOLS</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>NASA / GCMD Science Keywords</gco:CharacterString>
              </gmd:title>
              <gmd:date>
                <gmd:CI_Date>
                  <gmd:date>
                    <gco:Date>2008-02-05</gco:Date>
                  </gmd:date>
                  <gmd:dateType>
                    <gmd:CI_DateTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_DateTypeCode" codeListValue="revision">revision</gmd:CI_DateTypeCode>
                  </gmd:dateType>
                </gmd:CI_Date>
              </gmd:date>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
</gmi:MI_Metadata>`

describe('applyIso19115MetadataCorrections', () => {
  test('should handle missing corrections array gracefully', async () => {
    const params = {
      metadataPayload: '<gmi:MI_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"></gmi:MI_Metadata>'
    }

    const result = await applyIso19115MetadataCorrections(params)

    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toEqual([])
    expect(result.correctedMetadata).toBeDefined()
  })

  test('should return early when metadataPayload is missing', async () => {
    const params = {
      metadataPayload: undefined,
      corrections: []
    }

    const result = await applyIso19115MetadataCorrections(params)

    expect(result).toEqual({
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: [],
      stubbed: false
    })
  })

  test('should skip corrections with unknown schemes', async () => {
    const params = {
      metadataPayload: '<gmi:MI_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd"></gmi:MI_Metadata>',
      corrections: [
        {
          scheme: 'invalid-scheme',
          action: 'replace',
          oldKeywordObject: { Value: 'test' },
          newKeywordObject: { Value: 'new' }
        }
      ]
    }

    const result = await applyIso19115MetadataCorrections(params)

    // The correction was invalid, so nothing should be applied
    expect(result.correctionCount).toBe(0)
    expect(result.correctionsApplied).toEqual([])
  })
})

describe('when applying sciencekeywords ISO-19115 corrections', () => {
  test('should replace existing science keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
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
        VariableLevel1: 'PARTICLE SIZE',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    }

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML was updated
    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('EARTH SCIENCE &gt; OCEANS &gt; MARINE SEDIMENTS &gt; PARTICLE SIZE')
    expect(updatedXml).not.toContain('EARTH SCIENCE &gt; ATMOSPHERE &gt; AEROSOLS')
  })

  test('should delete existing science keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'sciencekeywords',
      action: 'delete',
      oldKeywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    }

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords

    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML no longer contains the MD_Keywords block
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('EARTH SCIENCE &gt; ATMOSPHERE &gt; AEROSOLS')
  })

  test('should delete single existing science keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithOneScienceKeyword)
    const correction = {
      scheme: 'sciencekeywords',
      action: 'delete',
      oldKeywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    }

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords

    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML no longer contains the MD_Keywords block
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('EARTH SCIENCE > ATMOSPHERE > AEROSOLS')
    expect(updatedXml).not.toContain('<gmd:descriptiveKeywords>')
  })
})

describe('when applying locations ISO-19115 corrections', () => {
  test('should replace existing location correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'locations',
      action: 'replace',
      oldKeywordObject: {
        Category: 'CONTINENT',
        Type: 'NORTH AMERICA',
        Subregion1: 'CANADA',
        Subregion2: 'ALBERTA',
        Subregion3: '',
        DetailedLocation: ''
      },
      newKeywordObject: {
        Category: 'CONTINENT',
        Type: 'NORTH AMERICA',
        Subregion1: 'MEXICO',
        Subregion2: '',
        Subregion3: '',
        DetailedLocation: ''
      }
    }

    const config = ISO_19115_SCHEME_EDITORS.locations
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML was updated
    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('CONTINENT &gt; NORTH AMERICA &gt; MEXICO')
    expect(updatedXml).not.toContain('Continent &gt; North America &gt; Canada &gt; Alberta')
  })

  test('should delete existing locations block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'locations',
      action: 'delete',
      oldKeywordObject: {
        Category: 'Continent',
        Type: 'North America',
        Subregion1: 'Greenland',
        Subregion2: '',
        Subregion3: '',
        DetailedLocation: ''
      }
    }

    const config = ISO_19115_SCHEME_EDITORS.locations

    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML no longer contains the MD_Keywords block
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('Continent &gt; North America &gt; Greenland')
  })
})

describe('when applying platforms ISO-19115 corrections', () => {
  test('should replace existing platform keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: {
        ShortName: 'AQUA'
      },
      newLongName: 'New Platform Description'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('AQUA &gt; New Platform Description')
    expect(updatedXml).not.toContain('AQUA &gt; Earth Observing System')
  })

  test('should delete existing platform keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'platforms',
      action: 'delete',
      oldKeywordObject: { ShortName: 'AQUA' }
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the specific keyword is gone
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('AQUA &gt; Earth Observing System, AQUA')
    expect(updatedXml).toContain('TERRA &gt; Earth Observing System, TERRA (AM-1)')
  })
})

describe('when applying instruments ISO-19115 corrections', () => {
  test('should replace existing instrument keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    // Example: Replace "MODIS > Earth Observing System"
    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'MODIS' },
      newKeywordObject: {
        ShortName: 'MODIS-1'
      },
      newLongName: 'New Instrument Description'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('MODIS-1 &gt; New Instrument Description')
    expect(updatedXml).not.toContain('MODIS &gt; Moderate-Resolution Imaging Spectroradiometer')
  })

  test('should delete existing instrument keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'instruments',
      action: 'delete',
      oldKeywordObject: { ShortName: 'ATLAS' }
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the specific keyword is gone
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('ATLAS &gt; Advanced Topographic Laser Altimeter System')
    expect(updatedXml).toContain('MODIS &gt; Moderate-Resolution Imaging Spectroradiometer')
  })
})

describe('when applying projects ISO-19115 corrections', () => {
  test('should replace existing project keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'projects',
      action: 'replace',
      oldKeywordObject: { ShortName: 'MEASURES' },
      newKeywordObject: {
        ShortName: 'MEASURES-1'
      },
      newLongName: 'New Project Description'
    }

    const config = ISO_19115_SCHEME_EDITORS.projects
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('MEASURES-1 &gt; New Project Description')
    expect(updatedXml).not.toContain('MEASURES &gt; Making Earth System Data Records for Use in Research Environments')
  })

  test('should delete existing project keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'projects',
      action: 'delete',
      oldKeywordObject: { ShortName: 'MEASURES' }
    }

    const config = ISO_19115_SCHEME_EDITORS.projects
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the specific keyword is gone
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('MEASURES &gt; Making Earth System Data Records for Use in Research Environments')
    expect(updatedXml).toContain('MAGIA &gt; Structure, Stratigraphy, and Sedimentology North of the Antarctic Peninsula')
  })
})

describe('when applying isotopiccategory ISO-19115 corrections', () => {
  test('should replace existing isotopiccategory correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'isotopiccategory',
      action: 'replace',
      oldKeywordObject: { Value: 'FARMING' },
      newKeywordObject: { Value: 'BIOTA' }
    }

    const config = ISO_19115_SCHEME_EDITORS.isotopiccategory
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    // Verify both the text content and the attribute were updated
    expect(updatedXml).toContain('<gmd:MD_TopicCategoryCode codeListValue="BIOTA">BIOTA</gmd:MD_TopicCategoryCode>')
    expect(updatedXml).not.toContain('codeListValue="FARMING">FARMING')
  })

  test('should delete existing isotopiccategory correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'isotopiccategory',
      action: 'delete',
      oldKeywordObject: { Value: 'LOCATION' }
    }

    const config = ISO_19115_SCHEME_EDITORS.isotopiccategory
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the specific category element is removed
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('codeListValue="LOCATION">LOCATION')
    // Verify other categories remain
    expect(updatedXml).toContain('codeListValue="FARMING">FARMING')
  })
})

describe('when applying productlevelid ISO-19115 corrections', () => {
  test('should replace existing productlevelid correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'productlevelid',
      action: 'replace',
      oldKeywordObject: { Value: '3' },
      newKeywordObject: { Value: '5' }
    }

    const config = ISO_19115_SCHEME_EDITORS.productlevelid
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    // 1. Data Identification location
    expect(updatedXml).toMatch(/<gmd:processingLevel>.*<gco:CharacterString>5<\/gco:CharacterString>/s)
    // 2. Image Description location
    expect(updatedXml).toMatch(/<gmd:contentInfo>.*<gco:CharacterString>5<\/gco:CharacterString>/s)
    expect(updatedXml).not.toContain('<gco:CharacterString>3</gco:CharacterString>')
  })

  test('should delete existing productlevelid correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'productlevelid',
      action: 'delete',
      oldKeywordObject: { Value: '3' }
    }

    const config = ISO_19115_SCHEME_EDITORS.productlevelid
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Verify that the Identifier block is completely gone from both expected locations
    expect(updatedXml).not.toContain('gov.nasa.esdis.umm.processinglevelid')
    expect(updatedXml).not.toContain('<gco:CharacterString>3</gco:CharacterString>')
  })
})

describe('when applying providers ISO-19115 corrections', () => {
  test('should replace existing providers keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'providers',
      action: 'replace',
      oldKeywordObject: { ShortName: 'DOC/NOAA/NESDIS/NCEI' },
      newKeywordObject: {
        ShortName: 'DOC/NOAA/NESDIS/NCEI-1'
      },
      newLongName: 'New Provider Description'
    }

    const config = ISO_19115_SCHEME_EDITORS.providers
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('DOC/NOAA/NESDIS/NCEI-1 &gt; New Provider Description')
    expect(updatedXml).not.toContain('DOC/NOAA/NESDIS/NCEI &gt; National Centers for Environmental Information, NESDIS, NOAA, U.S. Department of Commerce')
  })

  test('should delete existing providers keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'providers',
      action: 'delete',
      oldKeywordObject: { ShortName: 'DOC/NOAA/NESDIS/NCEI' }
    }

    const config = ISO_19115_SCHEME_EDITORS.providers
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the specific keyword is gone
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('DOC/NOAA/NESDIS/NCEI &gt; National Centers for Environmental Information, NESDIS, NOAA, U.S. Department of Commerce')
    expect(updatedXml).toContain('DOC/NOAA/NESDIS/NODC &gt; National Oceanographic Data Center, NESDIS, NOAA, U.S. Department of Commerce')
  })
})
