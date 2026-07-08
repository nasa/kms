import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect } from 'vitest'

import { ISO_19115_SCHEME_EDITORS } from '../Iso19115DomEditor'
import Iso19115MetadataPathEditor from '../Iso19115MetadataPathEditor'

const mockIsoSmap = readFileSync(
  join(__dirname, '../__mocks__/iso-smap.xml'),
  'utf-8'
)

describe('when applying isotopiccategory ISO-SMAP corrections', () => {
  test('should replace existing isotopiccategory correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)

    const correction = {
      scheme: 'isotopiccategory',
      action: 'replace',
      newKeywordObject: { Value: 'oceans' },
      oldKeywordObject: { Value: 'climatology' }
    }

    const config = ISO_19115_SCHEME_EDITORS.isotopiccategory
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('<gmd:MD_TopicCategoryCode codeListValue="oceans">oceans</gmd:MD_TopicCategoryCode>')
  })

  test('should delete existing isotopiccategory correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)

    const correction = {
      scheme: 'isotopiccategory',
      action: 'delete',
      oldKeywordObject: { Value: 'water' }
    }

    const config = ISO_19115_SCHEME_EDITORS.isotopiccategory
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    expect(updatedXml).not.toContain('<gmd:MD_TopicCategoryCode codeListValue="water">water</gmd:MD_TopicCategoryCode>')
  })
})

describe('when applying productlevelid ISO-SMAP corrections', () => {
  test('should replace existing productlevelid correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)

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
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)

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

    // Verify that parent wrappers are also removed
    expect(updatedXml).not.toContain('<gmd:processingLevel>')
    expect(updatedXml).not.toContain('<gmd:processingLevelCode>')
  })
})
