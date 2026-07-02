import {
  describe,
  expect,
  test
} from 'vitest'

import { ISO_19115_SCHEME_EDITORS } from '../Iso19115DomEditor'
import Iso19115MetadataPathEditor from '../Iso19115MetadataPathEditor'

// Mock with BOTH keyword blocks AND NSIDC acquisition information
// Tests synchronization between the two sections for the same instruments
const mockIso19115WithKeywordsAndAcquisition = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos" 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi" 
  xmlns:gml="http://www.opengis.net/gml/3.2" 
  xmlns:gmx="http://www.isotc211.org/2005/gmx"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>ATLAS &gt; Advanced Topographic Laser Altimeter System</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>MODIS &gt; Moderate Resolution Imaging Spectroradiometer</gco:CharacterString>
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
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:instrument>
        <eos:EOS_Instrument id="_ATLAS">
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>ATLAS</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.instrumentshortname</gco:CharacterString>
              </gmd:codeSpace>
              <gmd:description>
                <gco:CharacterString>Advanced Topographic Laser Altimeter System</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:type>
            <gco:CharacterString>instrument</gco:CharacterString>
          </gmi:type>
        </eos:EOS_Instrument>
      </gmi:instrument>
      <gmi:instrument>
        <eos:EOS_Instrument id="_MODIS">
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>MODIS</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.instrumentshortname</gco:CharacterString>
              </gmd:codeSpace>
              <gmd:description>
                <gco:CharacterString>Moderate Resolution Imaging Spectroradiometer</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:type>
            <gco:CharacterString>instrument</gco:CharacterString>
          </gmi:type>
        </eos:EOS_Instrument>
      </gmi:instrument>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

describe('Instrument corrections with synchronized keyword blocks and acquisition information', () => {
  test('should update BOTH keyword block and acquisition sections for ATLAS', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-2' },
      newLongName: 'Advanced Topographic Laser Altimeter System Version 2'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // 1. Verify keyword block updated
    expect(updatedXml).toContain('ATLAS-2 &gt; Advanced Topographic Laser Altimeter System Version 2')
    expect(updatedXml).not.toContain('ATLAS &gt; Advanced Topographic Laser Altimeter System')

    // 2. Verify acquisition gmd:code updated (ShortName only in NSIDC split format)
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS-2<\/gco:CharacterString>/)

    // 3. Verify acquisition identifier gmd:description updated (LongName only in NSIDC split format)
    expect(updatedXml).toMatch(/<gmd:MD_Identifier>[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS-2<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>Advanced Topographic Laser Altimeter System Version 2<\/gco:CharacterString>/)

    // 4. Verify MODIS remains unchanged
    expect(updatedXml).toContain('MODIS &gt; Moderate Resolution Imaging Spectroradiometer')
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>MODIS<\/gco:CharacterString>/)
  })

  test('should update BOTH sections for MODIS without affecting ATLAS', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'MODIS' },
      newKeywordObject: { ShortName: 'MODIS-2' },
      newLongName: 'Moderate Resolution Imaging Spectroradiometer Version 2'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // 1. MODIS keyword updated
    expect(updatedXml).toContain('MODIS-2 &gt; Moderate Resolution Imaging Spectroradiometer Version 2')
    expect(updatedXml).not.toContain('MODIS &gt; Moderate Resolution Imaging Spectroradiometer')

    // 2. MODIS acquisition code updated
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>MODIS-2<\/gco:CharacterString>/)

    // 3. MODIS acquisition description updated
    expect(updatedXml).toMatch(/<gmd:MD_Identifier>[\s\S]*?<gmd:code>\s*<gco:CharacterString>MODIS-2<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>Moderate Resolution Imaging Spectroradiometer Version 2<\/gco:CharacterString>/)

    // 4. ATLAS remains unchanged in both sections
    expect(updatedXml).toContain('ATLAS &gt; Advanced Topographic Laser Altimeter System')
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS<\/gco:CharacterString>/)
  })

  test('should handle sequential updates to different instruments', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    // First update ATLAS
    const atlasCorrection = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-NEW' },
      newLongName: 'New ATLAS Description'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const atlasSuccess = config(editor, atlasCorrection)

    // Then update MODIS
    const modisCorrection = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'MODIS' },
      newKeywordObject: { ShortName: 'MODIS-NEW' },
      newLongName: 'New MODIS Description'
    }

    const modisSuccess = config(editor, modisCorrection)

    expect(atlasSuccess).toBe(true)
    expect(modisSuccess).toBe(true)

    const updatedXml = editor.serialize()

    // Both keyword blocks updated correctly
    expect(updatedXml).toContain('ATLAS-NEW &gt; New ATLAS Description')
    expect(updatedXml).toContain('MODIS-NEW &gt; New MODIS Description')

    // Both acquisition sections updated independently
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS-NEW<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>MODIS-NEW<\/gco:CharacterString>/)

    // Descriptions updated independently
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS-NEW<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>New ATLAS Description<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>MODIS-NEW<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>New MODIS Description<\/gco:CharacterString>/)
  })

  test('should preserve codeSpace when updating instruments', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-3' },
      newLongName: 'Advanced Topographic Laser Altimeter System V3'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    config(editor, correction)

    const updatedXml = editor.serialize()

    // CodeSpace should remain unchanged
    expect(updatedXml).toContain('gov.nasa.esdis.umm.instrumentshortname')
    expect(updatedXml).toMatch(/<gmd:codeSpace>\s*<gco:CharacterString>gov.nasa.esdis.umm.instrumentshortname<\/gco:CharacterString>/)
  })

  test('should handle instrument with only ShortName update', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-5' }
      // No newLongName provided
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword should have just ShortName
    expect(updatedXml).toContain('<gco:CharacterString>ATLAS-5</gco:CharacterString>')

    // Acquisition code should be updated
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS-5<\/gco:CharacterString>/)
  })

  test('should delete instrument from BOTH keyword block and acquisition section', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'delete',
      oldKeywordObject: { ShortName: 'ATLAS' }
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword block should not contain ATLAS
    expect(updatedXml).not.toContain('ATLAS &gt; Advanced Topographic Laser Altimeter System')

    // MODIS keyword should remain
    expect(updatedXml).toContain('MODIS &gt; Moderate Resolution Imaging Spectroradiometer')

    // Acquisition section should still exist but ATLAS instrument should be removed
    expect(updatedXml).toContain('gmi:acquisitionInformation')
    expect(updatedXml).not.toContain('<eos:EOS_Instrument id="_ATLAS">')
    expect(updatedXml).not.toContain('ATLAS</gco:CharacterString>')

    // MODIS should still be in acquisition section
    expect(updatedXml).toContain('<eos:EOS_Instrument id="_MODIS">')
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>MODIS<\/gco:CharacterString>/)
  })

  test('should verify both instruments are independent in updates', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    // Update only ATLAS
    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-MODIFIED' },
      newLongName: 'Modified ATLAS'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    config(editor, correction)

    const updatedXml = editor.serialize()

    // ATLAS keyword updated correctly
    expect(updatedXml).toContain('ATLAS-MODIFIED &gt; Modified ATLAS')

    // ATLAS acquisition updated
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS-MODIFIED<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:description>\s*<gco:CharacterString>Modified ATLAS<\/gco:CharacterString>/)

    // MODIS completely unchanged in both keyword and acquisition
    expect(updatedXml).toContain('MODIS &gt; Moderate Resolution Imaging Spectroradiometer')
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>MODIS<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:description>\s*<gco:CharacterString>Moderate Resolution Imaging Spectroradiometer<\/gco:CharacterString>/)
  })

  test('should handle empty LongName gracefully', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'MODIS' },
      newKeywordObject: { ShortName: 'MODIS-SIMPLE' },
      newLongName: ''
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword should be just ShortName when LongName is empty
    expect(updatedXml).toContain('<gco:CharacterString>MODIS-SIMPLE</gco:CharacterString>')

    // Should not create malformed "MODIS-SIMPLE > "
    expect(updatedXml).not.toContain('MODIS-SIMPLE &gt; ')

    // Verify acquisition gmd:description is empty string (line 255 coverage for instruments)
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_MODIS">[\s\S]*?<gmd:description>\s*<gco:CharacterString><\/gco:CharacterString>/)
  })

  test('should handle undefined newLongName (not just empty string)', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-MINIMAL' }
      // NewLongName is completely omitted (undefined)
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword should be just ShortName when newLongName is undefined (line 188 coverage for instruments)
    expect(updatedXml).toContain('<gco:CharacterString>ATLAS-MINIMAL</gco:CharacterString>')
    expect(updatedXml).not.toContain('ATLAS-MINIMAL &gt;')

    // Verify acquisition code has only ShortName
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:code>\s*<gco:CharacterString>ATLAS-MINIMAL<\/gco:CharacterString>/)

    // Verify acquisition description is empty string when newLongName is falsy (line 255 coverage)
    expect(updatedXml).toMatch(/<eos:EOS_Instrument id="_ATLAS">[\s\S]*?<gmd:description>\s*<gco:CharacterString><\/gco:CharacterString>/)
  })

  test('should preserve CWIC format free-text description when updating with combined format', () => {
    // This specifically tests line 269 for instruments: return node?.textContent || ''
    const cwicXml = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos" 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>SIRAL &gt; SAR Interferometric Radar Altimeter</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="instrument">instrument</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:instrument>
        <gmi:MI_Instrument>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>SIRAL &gt; SAR Interferometric Radar Altimeter</gco:CharacterString>
              </gmd:code>
              <gmd:description>
                <gco:CharacterString>This is a custom free-text description that should be preserved in CWIC format for instruments</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:type>
            <gco:CharacterString>radar</gco:CharacterString>
          </gmi:type>
          <gmi:description>
            <gco:CharacterString>SIRAL is a synthetic aperture radar altimeter operating in Ku-band</gco:CharacterString>
          </gmi:description>
        </gmi:MI_Instrument>
      </gmi:instrument>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(cwicXml)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'SIRAL' },
      newKeywordObject: { ShortName: 'SIRAL-2' },
      newLongName: 'SAR Interferometric Radar Altimeter Version 2'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword updated with combined format
    expect(updatedXml).toContain('SIRAL-2 &gt; SAR Interferometric Radar Altimeter Version 2')

    // Acquisition code updated with combined format (detected ' > ')
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>SIRAL-2 &gt; SAR Interferometric Radar Altimeter Version 2<\/gco:CharacterString>/)

    // CRITICAL: Free-text description should be PRESERVED (line 269 coverage for instruments)
    // This tests the fallback: return node?.textContent || ''
    expect(updatedXml).toContain('This is a custom free-text description that should be preserved in CWIC format for instruments')

    // Instrument-level description also preserved
    expect(updatedXml).toContain('SIRAL is a synthetic aperture radar altimeter operating in Ku-band')
  })

  test('should handle CWIC format with null/undefined description node gracefully', () => {
    // Edge case: what if description node doesn't exist in CWIC format?
    const cwicXmlNoDesc = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos"
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi" 
  xmlns:gml="http://www.opengis.net/gml/3.2" 
  xmlns:gmx="http://www.isotc211.org/2005/gmx" 
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>TEST-RADAR &gt; Test Radar</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="instrument">instrument</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:instrument>
        <gmi:MI_Instrument>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>TEST-RADAR &gt; Test Radar</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Instrument>
      </gmi:instrument>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(cwicXmlNoDesc)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'TEST-RADAR' },
      newKeywordObject: { ShortName: 'TEST-RADAR-2' },
      newLongName: 'Test Radar Version 2'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Should handle gracefully even without description node (line 269: || '' fallback)
    expect(updatedXml).toContain('TEST-RADAR-2 &gt; Test Radar Version 2')
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>TEST-RADAR-2 &gt; Test Radar Version 2<\/gco:CharacterString>/)
  })

  test('should handle special characters in instrument names', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-1/2' },
      newLongName: 'Advanced Laser & System (Test)'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Special characters should be preserved in keyword
    expect(updatedXml).toContain('ATLAS-1/2 &gt; Advanced Laser &amp; System (Test)')

    // Special characters should be preserved in acquisition
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>ATLAS-1\/2<\/gco:CharacterString>/)
  })

  test('should maintain XML structure integrity after updates', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'ATLAS' },
      newKeywordObject: { ShortName: 'ATLAS-FINAL' },
      newLongName: 'Final ATLAS Version'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    config(editor, correction)

    const updatedXml = editor.serialize()

    // Verify XML is well-formed by checking key structural elements
    expect(updatedXml).toContain('<gmi:MI_Metadata')
    expect(updatedXml).toContain('</gmi:MI_Metadata>')
    expect(updatedXml).toContain('<gmd:identificationInfo>')
    expect(updatedXml).toContain('</gmd:identificationInfo>')
    expect(updatedXml).toContain('<gmi:acquisitionInformation>')
    expect(updatedXml).toContain('</gmi:acquisitionInformation>')

    // Verify all namespaces are preserved
    expect(updatedXml).toMatch(/xmlns:eos="http:\/\/earthdata.nasa.gov\/schema\/eos"/)
    expect(updatedXml).toMatch(/xmlns:gco="http:\/\/www.isotc211.org\/2005\/gco"/)
    expect(updatedXml).toMatch(/xmlns:gmd="http:\/\/www.isotc211.org\/2005\/gmd"/)
    expect(updatedXml).toMatch(/xmlns:gmi="http:\/\/www.isotc211.org\/2005\/gmi"/)
  })

  test('should handle MI_Instrument namespace variant', () => {
    const miInstrumentXml = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos" 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>TEST-SENSOR &gt; Test Sensor</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="instrument">instrument</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:instrument>
        <gmi:MI_Instrument>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>TEST-SENSOR</gco:CharacterString>
              </gmd:code>
              <gmd:description>
                <gco:CharacterString>Test Sensor</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:type>
            <gco:CharacterString>sensor</gco:CharacterString>
          </gmi:type>
        </gmi:MI_Instrument>
      </gmi:instrument>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(miInstrumentXml)

    const correction = {
      scheme: 'instruments',
      action: 'replace',
      oldKeywordObject: { ShortName: 'TEST-SENSOR' },
      newKeywordObject: { ShortName: 'TEST-SENSOR-2' },
      newLongName: 'Test Sensor Version 2'
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword updated
    expect(updatedXml).toContain('TEST-SENSOR-2 &gt; Test Sensor Version 2')

    // MI_Instrument acquisition updated
    expect(updatedXml).toMatch(/<gmi:MI_Instrument>[\s\S]*?<gmd:code>\s*<gco:CharacterString>TEST-SENSOR-2<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<gmd:description>\s*<gco:CharacterString>Test Sensor Version 2<\/gco:CharacterString>/)
  })

  test('should handle delete with MI_Instrument namespace', () => {
    const miInstrumentXml = `
<gmi:MI_Metadata 
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>SENSOR-A</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="instrument">instrument</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:instrument>
        <gmi:MI_Instrument>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>SENSOR-A</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Instrument>
      </gmi:instrument>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(miInstrumentXml)

    const correction = {
      scheme: 'instruments',
      action: 'delete',
      oldKeywordObject: { ShortName: 'SENSOR-A' }
    }

    const config = ISO_19115_SCHEME_EDITORS.instruments
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword removed
    expect(updatedXml).not.toContain('SENSOR-A')

    // MI_Instrument removed from acquisition
    expect(updatedXml).not.toContain('<gmi:MI_Instrument>')

    // But acquisition section structure remains
    expect(updatedXml).toContain('gmi:acquisitionInformation')
  })
})
