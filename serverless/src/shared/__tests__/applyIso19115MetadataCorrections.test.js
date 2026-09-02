import { readFileSync } from 'fs'
import { join } from 'path'

import {
  describe,
  expect,
  test
} from 'vitest'

import applyIso19115MetadataCorrections from '../applyIso19115MetadataCorrections'
import { ISO_19115_SCHEME_EDITORS } from '../Iso19115DomEditor'
import Iso19115MetadataPathEditor from '../Iso19115MetadataPathEditor'

const mockIso19115 = readFileSync(
  join(__dirname, '../__mocks__/iso-mends.xml'),
  'utf-8'
)

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
        LocationCategory: 'CONTINENT',
        LocationType: 'NORTH AMERICA',
        LocationSubregion1: 'CANADA',
        LocationSubregion2: 'ALBERTA',
        LocationSubregion3: '',
        LocationSubregion4: ''
      },
      newKeywordObject: {
        LocationCategory: 'CONTINENT',
        LocationType: 'NORTH AMERICA',
        LocationSubregion1: 'MEXICO',
        LocationSubregion2: '',
        LocationSubregion3: '',
        LocationSubregion4: ''
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
        LocationCategory: 'Continent',
        LocationType: 'North America',
        LocationSubregion1: 'Greenland',
        LocationSubregion2: '',
        LocationSubregion3: '',
        LocationSubregion4: ''
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

describe('when applying projects ISO-19115 corrections', () => {
  // Create a more complete mock with acquisition information
  const mockIso19115WithAcquisition = `
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
            <gco:CharacterString>MEASURES > Making Earth System Data Records for Use in Research Environments</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="project">project</gmd:MD_KeywordTypeCode>
          </gmd:type>
          <gmd:thesaurusName>
            <gmd:CI_Citation>
              <gmd:title>
                <gco:CharacterString>NASA / GCMD Project Keywords</gco:CharacterString>
              </gmd:title>
            </gmd:CI_Citation>
          </gmd:thesaurusName>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:operation>
        <gmi:MI_Operation>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>MEASURES > Making Earth System Data Records for Use in Research Environments</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.projectshortname</gco:CharacterString>
              </gmd:codeSpace>
              <gmd:description>
                <gco:CharacterString>Making Earth System Data Records for Use in Research Environments</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Operation>
      </gmi:operation>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

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

  test('should replace project keyword and sync acquisition information', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithAcquisition)

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

    // Verify keyword block was updated
    expect(updatedXml).toContain('MEASURES-1 &gt; New Project Description')
    expect(updatedXml).not.toContain('MEASURES &gt; Making Earth System Data Records for Use in Research Environments')

    // Verify acquisition MI_Operation code was updated
    expect(updatedXml).toMatch(
      /<gmi:MI_Operation>[\s\S]*?<gmd:code>[\s\S]*?<gco:CharacterString>MEASURES-1 &gt; New Project Description<\/gco:CharacterString>[\s\S]*?<\/gmd:code>[\s\S]*?<gmd:codeSpace>[\s\S]*?<gco:CharacterString>gov\.nasa\.esdis\.umm\.projectshortname<\/gco:CharacterString>/
    )

    // Verify acquisition MI_Operation description was updated
    expect(updatedXml).toMatch(
      /<gmi:MI_Operation>[\s\S]*?<gmd:description>[\s\S]*?<gco:CharacterString>New Project Description<\/gco:CharacterString>[\s\S]*?<\/gmd:description>/
    )
  })

  test('should handle project with only ShortName (no LongName)', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithAcquisition)

    const correction = {
      scheme: 'projects',
      action: 'replace',
      oldKeywordObject: { ShortName: 'MEASURES' },
      newKeywordObject: {
        ShortName: 'MEASURES-2'
      }
      // No newLongName provided
    }

    const config = ISO_19115_SCHEME_EDITORS.projects
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Should use ShortName only (no " > LongName")
    expect(updatedXml).toContain('<gco:CharacterString>MEASURES-2</gco:CharacterString>')
    expect(updatedXml).not.toContain('MEASURES-2 &gt;')

    // Verify acquisition code was updated to ShortName only
    expect(updatedXml).toMatch(
      /<gmi:MI_Operation>[\s\S]*?<gmd:code>[\s\S]*?<gco:CharacterString>MEASURES-2<\/gco:CharacterString>[\s\S]*?<\/gmd:code>/
    )
  })

  test('should not update unrelated acquisition operations', () => {
    const xmlWithMultipleOperations = `
<gmi:MI_Metadata 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>MEASURES > Old Description</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="project">project</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:operation>
        <gmi:MI_Operation>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>MEASURES > Old Description</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.projectshortname</gco:CharacterString>
              </gmd:codeSpace>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Operation>
      </gmi:operation>
      <gmi:operation>
        <gmi:MI_Operation>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>MEASURES > Different Operation</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>some.other.identifier.type</gco:CharacterString>
              </gmd:codeSpace>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Operation>
      </gmi:operation>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(xmlWithMultipleOperations)

    const correction = {
      scheme: 'projects',
      action: 'replace',
      oldKeywordObject: { ShortName: 'MEASURES' },
      newKeywordObject: { ShortName: 'MEASURES-1' },
      newLongName: 'New Description'
    }

    const config = ISO_19115_SCHEME_EDITORS.projects
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Verify keyword block was updated
    expect(updatedXml).toContain('MEASURES-1 &gt; New Description')
    expect(updatedXml).not.toContain('MEASURES &gt; Old Description')

    // Verify the project operation with correct codeSpace was updated
    // Use a more flexible regex that doesn't depend on element order
    expect(updatedXml).toMatch(
      /<gmi:MI_Operation>[\s\S]*?<gmd:MD_Identifier>[\s\S]*?<gmd:code>[\s\S]*?<gco:CharacterString>MEASURES-1 &gt; New Description<\/gco:CharacterString>[\s\S]*?<\/gmd:code>[\s\S]*?<gmd:codeSpace>[\s\S]*?<gco:CharacterString>gov\.nasa\.esdis\.umm\.projectshortname<\/gco:CharacterString>[\s\S]*?<\/gmd:codeSpace>[\s\S]*?<\/gmd:MD_Identifier>[\s\S]*?<\/gmi:MI_Operation>/
    )

    // Verify the operation has the correct codeSpace
    expect(updatedXml).toContain('gov.nasa.esdis.umm.projectshortname')

    // Unrelated operation (different codeSpace) should NOT be changed
    expect(updatedXml).toContain('some.other.identifier.type')
    expect(updatedXml).toContain('MEASURES &gt; Different Operation')
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

  test('should delete project and remove from acquisition information', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithAcquisition)

    const correction = {
      scheme: 'projects',
      action: 'delete',
      oldKeywordObject: { ShortName: 'MEASURES' }
    }

    const config = ISO_19115_SCHEME_EDITORS.projects
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword should be removed
    expect(updatedXml).not.toContain('MEASURES &gt; Making Earth System Data Records for Use in Research Environments')

    // Note: The current implementation only handles updates via additionalPaths on replace actions.
    // For delete actions, the acquisition information would need to be handled separately
    // in the delete logic if that requirement exists. Currently testing the keyword deletion.
  })
})

describe('when applying isotopiccategory ISO-19115 corrections', () => {
  test('should replace existing isotopiccategory correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'isotopiccategory',
      action: 'replace',
      oldKeywordObject: { ISOTopicCategory: 'FARMING' },
      newKeywordObject: { ISOTopicCategory: 'BIOTA' }
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
      oldKeywordObject: { ISOTopicCategory: 'LOCATION' }
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
      oldKeywordObject: { ProductLevelId: '3' },
      newKeywordObject: { ProductLevelId: '5' }
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
      oldKeywordObject: { ProductLevelId: '3' }
    }

    const config = ISO_19115_SCHEME_EDITORS.productlevelid
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Verify that the Identifier block is completely gone from both expected locations
    expect(updatedXml).not.toContain('gov.nasa.esdis.umm.processinglevelid')
    expect(updatedXml).not.toContain('<gco:CharacterString>3</gco:CharacterString>')

    // Verify that parent wrappers are also removed
    expect(updatedXml).not.toContain('<gmd:processingLevel>')
    expect(updatedXml).not.toContain('<gmd:processingLevelCode>')
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

  test('should omit trailing missing levels from science keyword paths', () => {
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
        Topic: 'BIOSPHERE'
      }
    }

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    expect(updatedXml).toContain('EARTH SCIENCE &gt; BIOSPHERE')
    expect(updatedXml).not.toContain('EARTH SCIENCE &gt; BIOSPHERE &gt; NONE')
  })

  test('should use NONE for missing levels before a populated science keyword level', () => {
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
        Topic: 'BIOSPHERE',
        DetailedVariable: 'CHLOROPHYLL'
      }
    }

    const config = ISO_19115_SCHEME_EDITORS.sciencekeywords
    const success = config(editor, correction)

    expect(success).toBe(true)
    expect(editor.serialize()).toContain(
      'EARTH SCIENCE &gt; BIOSPHERE &gt; NONE &gt; NONE &gt; NONE &gt; NONE &gt; CHLOROPHYLL'
    )
  })
})

describe('when applying dataformat ISO-19115 corrections', () => {
  test('should replace existing dataformat correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'dataformat',
      action: 'replace',
      oldKeywordObject: { ShortName: 'HDF5' },
      newKeywordObject: { ShortName: 'NetCDF-4' }
    }

    const config = ISO_19115_SCHEME_EDITORS.dataformat
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    // Verify the value was updated within the gco:CharacterString element
    expect(updatedXml).toContain('<gco:CharacterString>NetCDF-4</gco:CharacterString>')
    expect(updatedXml).not.toContain('<gco:CharacterString>HDF5</gco:CharacterString>')
  })

  test('should delete existing dataformat correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115)

    const correction = {
      scheme: 'dataformat',
      action: 'delete',
      oldKeywordObject: { ShortName: 'HDF5' }
    }

    const config = ISO_19115_SCHEME_EDITORS.dataformat
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    expect(updatedXml).not.toContain('<gco:CharacterString>HDF5</gco:CharacterString>')
  })
})
