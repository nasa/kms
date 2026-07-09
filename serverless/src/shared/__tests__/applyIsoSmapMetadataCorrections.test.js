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

describe('when applying sciencekeywords ISO-SMAP corrections', () => {
  test('should replace existing science keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)
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
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)
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
})

describe('when applying platforms ISO-SMAP corrections', () => {
  test('should replace existing platform keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)

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
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)
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

describe('when applying instruments ISO-SMAP corrections', () => {
  test('should replace existing instrument keyword correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)

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
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)
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

describe('when applying locations ISO-SMAP corrections', () => {
  test('should replace existing location correctly', () => {
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)
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
    const editor = new Iso19115MetadataPathEditor(mockIsoSmap)
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
