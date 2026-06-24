import {
  describe,
  expect,
  test
} from 'vitest'

import { ISO_19115_SCHEME_EDITORS } from '../Iso19115DomEditor'
import Iso19115MetadataPathEditor from '../Iso19115MetadataPathEditor'

const mockIso19115 = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos" 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi" 
  xmlns:gml="http://www.opengis.net/gml/3.2" 
  xmlns:xlink="http://www.w3.org/1999/xlink" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
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
</gmi:MI_Metadata>`

describe('when applying sciencekeywords ISO-19115 corrections', () => {
  test('should replace existing science keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'sciencekeywords',
      action: 'replace',
      oldKeywordObject: { Value: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS' },
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

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML was updated
    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('<gco:CharacterString>EARTH SCIENCE &gt; OCEANS &gt; MARINE SEDIMENTS</gco:CharacterString>')
    expect(updatedXml).not.toContain('AEROSOLS')
  })

  test('should delete existing science keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)
    const correction = {
      scheme: 'sciencekeywords',
      action: 'delete',
      oldKeywordObject: { Value: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS' }
    }

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords

    // Note: You may need to add an updateBlockNode implementation for 'delete'
    // in iso19115DomEditor.js similar to the one shown below.
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML no longer contains the MD_Keywords block
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('EARTH SCIENCE > ATMOSPHERE > AEROSOLS')
  })

  test('should delete single existing science keyword block correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithOneScienceKeyword)
    const correction = {
      scheme: 'sciencekeywords',
      action: 'delete',
      oldKeywordObject: { Value: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS' }
    }

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords

    // Note: You may need to add an updateBlockNode implementation for 'delete'
    // in iso19115DomEditor.js similar to the one shown below.
    const success = config(editor, correction)

    expect(success).toBe(true)

    // Verify the XML no longer contains the MD_Keywords block
    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('EARTH SCIENCE > ATMOSPHERE > AEROSOLS')
    expect(updatedXml).not.toContain('<gmd:descriptiveKeywords>')
  })
})

describe('when applying platforms ISO-19115 corrections', () => {
  test('should replace existing platform keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    // Example: Replace "AQUA > Earth Observing System"
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
    expect(updatedXml).toContain('<gco:CharacterString>AQUA &gt; New Platform Description</gco:CharacterString>')
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

    // Example: Replace "AQUA > Earth Observing System"
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
    expect(updatedXml).toContain('<gco:CharacterString>MODIS-1 &gt; New Instrument Description</gco:CharacterString>')
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
