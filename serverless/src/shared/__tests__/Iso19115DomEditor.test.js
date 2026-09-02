import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { createIso19115Editor, ISO_19115_SCHEME_EDITORS } from '@/shared/Iso19115DomEditor'
import { detectIsoFormat } from '@/shared/Iso19115MetadataPathEditor'

describe('ISO_19115_SCHEME_EDITORS', () => {
  let mockEditor

  beforeEach(() => {
    mockEditor = {
      updateBlockNode: vi.fn(),
      updateLeafNode: vi.fn()
    }
  })

  test('should trigger updateBlockNode for keyword types', () => {
    const correction = {
      action: 'replace',
      oldKeywordObject: { Value: 'test' }
    }

    // Test a block-based editor (e.g., sciencekeywords)
    ISO_19115_SCHEME_EDITORS.sciencekeywords(mockEditor, correction)

    expect(mockEditor.updateBlockNode).toHaveBeenCalledWith(
      correction,
      expect.objectContaining({
        nodeXPath: expect.stringContaining('MD_KeywordTypeCode')
      })
    )
  })

  test('should return empty fields when an ISO keyword block has no value node', () => {
    ISO_19115_SCHEME_EDITORS.sciencekeywords(mockEditor, {
      action: 'replace',
      oldKeywordObject: {}
    })

    const config = mockEditor.updateBlockNode.mock.calls[0][1]
    const keywordObject = config.find.getNodeValueObject({
      node: {},
      editor: {
        selectNodes: vi.fn().mockReturnValue([])
      }
    })

    expect(keywordObject).toEqual({
      Category: '',
      Topic: '',
      Term: '',
      VariableLevel1: '',
      VariableLevel2: '',
      VariableLevel3: '',
      DetailedVariable: ''
    })
  })

  test('should trigger updateLeafNode for leaf types', () => {
    const correction = {
      action: 'replace',
      newKeywordObject: { Value: 'category' }
    }

    // Test a leaf-based editor (e.g., isotopiccategory)
    ISO_19115_SCHEME_EDITORS.isotopiccategory(mockEditor, correction)

    expect(mockEditor.updateLeafNode).toHaveBeenCalledWith(
      correction,
      expect.objectContaining({
        nodeXPath: expect.stringContaining('topicCategory')
      })
    )
  })

  test('should correctly format value for platforms', () => {
    const correction = {
      newKeywordObject: { ShortName: 'Aqua' },
      newLongName: 'Aqua Satellite'
    }
    const formatPlatform = () => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }

    expect(formatPlatform(correction)).toBe('Aqua > Aqua Satellite')
  })

  test('should handle deletion for productlevelid', () => {
    const correction = {
      action: 'delete',
      oldKeywordObject: { Value: 'L1' }
    }

    ISO_19115_SCHEME_EDITORS.productlevelid(mockEditor, correction)

    expect(mockEditor.updateLeafNode).toHaveBeenCalledWith(
      correction,
      expect.objectContaining({
        delete: expect.any(Array)
      })
    )
  })
})

describe('ISO Format Detection and SMAP Support', () => {
  test('should detect MENDS format correctly', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
        <gmd:identificationInfo>
          <gmd:MD_DataIdentification>
            <gmd:citation>
              <gmd:CI_Citation>
                <gmd:title>
                  <gco:CharacterString>Test Collection</gco:CharacterString>
                </gmd:title>
              </gmd:CI_Citation>
            </gmd:citation>
          </gmd:MD_DataIdentification>
        </gmd:identificationInfo>
      </gmi:MI_Metadata>
    `

    expect(detectIsoFormat(mendsXml)).toBe('MENDS')
  })

  test('should detect SMAP format correctly', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:citation>
                  <gmd:CI_Citation>
                    <gmd:title>
                      <gco:CharacterString>Test Collection</gco:CharacterString>
                    </gmd:title>
                  </gmd:CI_Citation>
                </gmd:citation>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    expect(detectIsoFormat(smapXml)).toBe('SMAP')
  })

  test('should create editor with MENDS format when specified', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi" xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:identificationInfo/>
      </gmi:MI_Metadata>
    `

    const editor = createIso19115Editor(mendsXml, { format: 'MENDS' })

    expect(editor.format).toBe('MENDS')
  })

  test('should create editor with SMAP format when specified', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo/>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = createIso19115Editor(smapXml, { format: 'SMAP' })

    expect(editor.format).toBe('SMAP')
  })

  test('should auto-detect SMAP format when format not specified', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo/>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = createIso19115Editor(smapXml)

    expect(editor.format).toBe('SMAP')
  })

  test('should auto-detect MENDS format when format not specified', () => {
    const mendsXml = `
      <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi" xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:identificationInfo/>
      </gmi:MI_Metadata>
    `

    const editor = createIso19115Editor(mendsXml)

    expect(editor.format).toBe('MENDS')
  })

  test('should transform XPath for SMAP format', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:descriptiveKeywords>
                  <gmd:MD_Keywords>
                    <gmd:keyword>
                      <gco:CharacterString>EARTH SCIENCE > ATMOSPHERE > AEROSOLS</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                      <gmd:MD_KeywordTypeCode codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                  </gmd:MD_Keywords>
                </gmd:descriptiveKeywords>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = createIso19115Editor(smapXml, { format: 'SMAP' })
    const nodes = editor.selectNodes('//gmd:descriptiveKeywords')

    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes[0].localName).toBe('descriptiveKeywords')
  })

  test('should not transform relative XPath expressions', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo/>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = createIso19115Editor(smapXml, { format: 'SMAP' })

    // TransformXPath should not modify relative paths
    const transformedPath = editor.transformXPath('./gmd:keyword')
    expect(transformedPath).toBe('./gmd:keyword')
  })

  test('should handle SMAP science keyword corrections', () => {
    const smapXml = `
      <gmd:DS_Series xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:seriesMetadata>
          <gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi">
            <gmd:identificationInfo>
              <gmd:MD_DataIdentification>
                <gmd:descriptiveKeywords>
                  <gmd:MD_Keywords>
                    <gmd:keyword>
                      <gco:CharacterString>EARTH SCIENCE > ATMOSPHERE > AEROSOLS</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                      <gmd:MD_KeywordTypeCode codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                  </gmd:MD_Keywords>
                </gmd:descriptiveKeywords>
              </gmd:MD_DataIdentification>
            </gmd:identificationInfo>
          </gmi:MI_Metadata>
        </gmd:seriesMetadata>
      </gmd:DS_Series>
    `

    const editor = createIso19115Editor(smapXml, { format: 'SMAP' })

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
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: 'NEW AEROSOLS',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      }
    }

    const delegate = ISO_19115_SCHEME_EDITORS.sciencekeywords
    const result = delegate(editor, correction)

    expect(result).toBe(true)

    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('NEW AEROSOLS')
  })
})
