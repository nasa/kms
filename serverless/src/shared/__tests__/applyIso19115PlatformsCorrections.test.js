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
  xmlns:gmx="http://www.isotc211.org/2005/gmx"
  xmlns:xlink="http://www.w3.org/1999/xlink" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
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
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
</gmi:MI_Metadata>`

// ============================================================================
// PLATFORM TESTS WITH ACQUISITION INFORMATION
// Comprehensive tests for platforms across all data center formats
// ============================================================================

// Mock XML with NSIDC format (ISO MENDS compliant)
// ShortName in gmd:code, LongName in gmd:description
const mockIso19115WithNSIDCAcquisition = `
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
            <gco:CharacterString>ICESat-2 &gt; Ice, Cloud, and land Elevation Satellite-2</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>ATLAS &gt; Advanced Topographic Laser Altimeter System</gco:CharacterString>
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
      <gmi:platform>
        <eos:EOS_Platform id="_ICESat-2">
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>ICESat-2</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.platformshortname</gco:CharacterString>
              </gmd:codeSpace>
              <gmd:description>
                <gco:CharacterString>Ice, Cloud, and land Elevation Satellite-2</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>Earth Observation Satellites</gco:CharacterString>
          </gmi:description>
          <gmi:instrument xlink:href="#_ATLAS"/>
        </eos:EOS_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

// Mock XML with CWIC format (non-compliant)
// Combined "ShortName > LongName" in gmd:code
const mockIso19115WithCWICAcquisition = `
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
            <gco:CharacterString>AQUA &gt; Earth Observing System, AQUA</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>AMSR-E &gt; Advanced Microwave Scanning Radiometer-EOS</gco:CharacterString>
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
                <gco:CharacterString>AMSR-E &gt; Advanced Microwave Scanning Radiometer-EOS</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:type>
            <gco:CharacterString>sensor</gco:CharacterString>
          </gmi:type>
          <gmi:description>
            <gco:CharacterString>The Advanced Microwave Scanning Radiometer for EOS (AMSR-E) is a twelve-channel, six-frequency, total power passive-microwave radiometer system.</gco:CharacterString>
          </gmi:description>
        </gmi:MI_Instrument>
      </gmi:instrument>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>AQUA &gt; Earth Observing System, AQUA</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>Aqua is a NASA polar orbiting mission designed to collect information on the Earth's atmospheric, land and ocean systems.</gco:CharacterString>
          </gmi:description>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

// Mock XML with NOAA format (simple format)
// ShortName only in gmd:code, free-text in gmd:description
const mockIso19115WithNOAAAcquisition = `
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
            <gco:CharacterString>NAGASAKI-MARU</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>net - zooplankton net</gco:CharacterString>
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
                <gco:CharacterString>net - zooplankton net</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:type>
            <gco:CharacterString>net - zooplankton net</gco:CharacterString>
          </gmi:type>
          <gmi:description>
            <gco:CharacterString>net - zooplankton net</gco:CharacterString>
          </gmi:description>
        </gmi:MI_Instrument>
      </gmi:instrument>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>NAGASAKI-MARU</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>Additional information from ICES for the vessel NAGASAKI-MARU from JAPAN.</gco:CharacterString>
          </gmi:description>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

describe('Platform corrections with acquisition information', () => {
  describe('NSIDC format (split: ShortName in code, LongName in description)', () => {
    test('should update keyword block and both acquisition paths correctly', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithNSIDCAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'ICESat-2' },
        newKeywordObject: { ShortName: 'ICESat-3' },
        newLongName: 'Ice, Cloud, and land Elevation Satellite-3'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // 1. Verify keyword block updated
      expect(updatedXml).toContain('ICESat-3 &gt; Ice, Cloud, and land Elevation Satellite-3')
      expect(updatedXml).not.toContain('ICESat-2 &gt; Ice, Cloud, and land Elevation Satellite-2')

      // 2. Verify acquisition gmd:code updated (ShortName only)
      expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>ICESat-3<\/gco:CharacterString>\s*<\/gmd:code>/)

      // 3. Verify acquisition gmd:description updated (LongName only)
      expect(updatedXml).toMatch(/<gmd:description>\s*<gco:CharacterString>Ice, Cloud, and land Elevation Satellite-3<\/gco:CharacterString>/)
    })

    test('should preserve platformshortname codeSpace', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithNSIDCAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'ICESat-2' },
        newKeywordObject: { ShortName: 'ICESat-3' },
        newLongName: 'Ice, Cloud, and land Elevation Satellite-3'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      config(editor, correction)

      const updatedXml = editor.serialize()
      expect(updatedXml).toContain('gov.nasa.esdis.umm.platformshortname')
    })

    test('should handle platform with only ShortName (no LongName)', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithNSIDCAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'ICESat-2' },
        newKeywordObject: { ShortName: 'ICESat-3' }
        // No newLongName provided
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // Keyword block should have just ShortName
      expect(updatedXml).toContain('<gco:CharacterString>ICESat-3</gco:CharacterString>')
      // Acquisition code should be updated
      expect(updatedXml).toContain('gov.nasa.esdis.umm.platformshortname')
      expect(updatedXml).toMatch(/<eos:EOS_Platform[\s\S]*?<gmd:code>\s*<gco:CharacterString>ICESat-3<\/gco:CharacterString>/)
    })

    test('should delete platform from both keyword block and acquisition section', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithNSIDCAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'delete',
        oldKeywordObject: { ShortName: 'ICESat-2' }
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // Keyword block should be gone
      expect(updatedXml).not.toContain('ICESat-2 &gt; Ice, Cloud, and land Elevation Satellite-2')

      // Acquisition platform should also be deleted
      expect(updatedXml).not.toContain('<eos:EOS_Platform id="_ICESat-2">')
      expect(updatedXml).not.toContain('ICESat-2</gco:CharacterString>')

      // But acquisition section and instrument should remain
      expect(updatedXml).toContain('gmi:acquisitionInformation')
      expect(updatedXml).toContain('eos:EOS_Instrument')
    })
  })

  describe('CWIC format (combined: ShortName > LongName in code)', () => {
    test('should detect and preserve combined format in gmd:code', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithCWICAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'AQUA' },
        newKeywordObject: { ShortName: 'AQUA-2' },
        newLongName: 'Earth Observing System, AQUA Version 2'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // 1. Verify keyword block updated
      expect(updatedXml).toContain('AQUA-2 &gt; Earth Observing System, AQUA Version 2')

      // 2. Verify acquisition gmd:code uses combined format (detected ' > ' in existing)
      expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>AQUA-2 &gt; Earth Observing System, AQUA Version 2<\/gco:CharacterString>\s*<\/gmd:code>/)

      // 3. Verify acquisition gmd:description preserved (free-text not overwritten)
      expect(updatedXml).toContain('Aqua is a NASA polar orbiting mission designed to collect information on the Earth\'s atmospheric, land and ocean systems.')
    })

    test('should not overwrite free-text description in CWIC format', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithCWICAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'AQUA' },
        newKeywordObject: { ShortName: 'AQUA-2' },
        newLongName: 'Earth Observing System, AQUA Version 2'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      config(editor, correction)

      const updatedXml = editor.serialize()

      // Free-text description should remain unchanged
      expect(updatedXml).toContain('Aqua is a NASA polar orbiting mission')
    })
  })

  describe('NOAA format (simple: ShortName only in code)', () => {
    test('should update keyword block and acquisition gmd:code', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithNOAAAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'NAGASAKI-MARU' },
        newKeywordObject: { ShortName: 'NAGASAKI-MARU-2' },
        newLongName: 'Updated Vessel Name'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // 1. Verify keyword block updated (will include LongName if provided)
      expect(updatedXml).toContain('NAGASAKI-MARU-2 &gt; Updated Vessel Name')

      // 2. Verify acquisition gmd:code updated (ShortName only - split format)
      expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>NAGASAKI-MARU-2<\/gco:CharacterString>/)

      // 3. NOAA format doesn't have gmd:description in gmd:identifier,
      // so the free-text gmi:description at platform level is preserved
      expect(updatedXml).toContain('Additional information from ICES for the vessel NAGASAKI-MARU from JAPAN.')
    })

    test('should handle platforms with no LongName', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithNOAAAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'NAGASAKI-MARU' },
        newKeywordObject: { ShortName: 'NAGASAKI-MARU-2' }
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // Keyword block should just have ShortName
      expect(updatedXml).toContain('<gco:CharacterString>NAGASAKI-MARU-2</gco:CharacterString>')

      // Acquisition gmd:code should be updated
      expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>NAGASAKI-MARU-2<\/gco:CharacterString>/)
    })
  })

  describe('without acquisition information', () => {
    test('should handle missing acquisition section gracefully', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'AQUA' },
        newKeywordObject: { ShortName: 'AQUA-2' },
        newLongName: 'New Description'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // Only keyword block should be updated
      expect(updatedXml).toContain('AQUA-2 &gt; New Description')

      // No acquisition section to update
      expect(updatedXml).not.toContain('gmi:acquisitionInformation')
    })

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

  describe('mixed namespace formats', () => {
    test('should handle both EOS and MI namespaces', () => {
      const mixedNamespaceXml = `
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
            <gco:CharacterString>TEST-PLATFORM &gt; Test Platform</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <eos:EOS_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>TEST-PLATFORM</gco:CharacterString>
              </gmd:code>
              <gmd:description>
                <gco:CharacterString>Test Platform</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </eos:EOS_Platform>
      </gmi:platform>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>TEST-PLATFORM</gco:CharacterString>
              </gmd:code>
              <gmd:description>
                <gco:CharacterString>Test Platform</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

      const editor = new Iso19115MetadataPathEditor(mixedNamespaceXml)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'TEST-PLATFORM' },
        newKeywordObject: { ShortName: 'TEST-PLATFORM-2' },
        newLongName: 'Updated Test Platform'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // All three locations should be updated
      // 1. Keyword block
      expect(updatedXml).toContain('TEST-PLATFORM-2 &gt; Updated Test Platform')

      // 2. EOS_Platform
      const eosMatches = updatedXml.match(/eos:EOS_Platform[\s\S]*?<gmd:code>\s*<gco:CharacterString>TEST-PLATFORM-2<\/gco:CharacterString>/)
      expect(eosMatches).toBeTruthy()

      // 3. MI_Platform
      const miMatches = updatedXml.match(/gmi:MI_Platform[\s\S]*?<gmd:code>\s*<gco:CharacterString>TEST-PLATFORM-2<\/gco:CharacterString>/)
      expect(miMatches).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    test('should correctly detect format when code contains > in text', () => {
      const edgeCaseXml = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos"
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>SPECIAL&gt;PLATFORM &gt; With Greater Than</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>SPECIAL&gt;PLATFORM &gt; With Greater Than</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>Free text description</gco:CharacterString>
          </gmi:description>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

      const editor = new Iso19115MetadataPathEditor(edgeCaseXml)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'SPECIAL>PLATFORM' },
        newKeywordObject: { ShortName: 'SPECIAL>PLATFORM-2' },
        newLongName: 'With Greater Than Updated'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // Should detect combined format and preserve it
      expect(updatedXml).toContain('SPECIAL&gt;PLATFORM-2 &gt; With Greater Than Updated')

      // Free text description should be preserved
      expect(updatedXml).toContain('Free text description')
    })

    test('should handle whitespace variations around delimiter', () => {
      // Note: Keywords with '>' but without spaces (e.g., 'PLATFORM>Long Name')
      // don't split properly since we split on ' > ' with spaces.
      // This test uses proper formatting with spaces.
      const whitespaceXml = `
<gmi:MI_Metadata 
  xmlns:eos="http://earthdata.nasa.gov/schema/eos"
  xmlns:gco="http://www.isotc211.org/2005/gco" 
  xmlns:gmd="http://www.isotc211.org/2005/gmd" 
  xmlns:gmi="http://www.isotc211.org/2005/gmi">
  <gmd:identificationInfo>
    <gmd:MD_DataIdentification>
      <gmd:descriptiveKeywords>
        <gmd:MD_Keywords>
          <gmd:keyword>
            <gco:CharacterString>PLATFORM &gt; Long Name</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>PLATFORM &gt; Long Name</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

      const editor = new Iso19115MetadataPathEditor(whitespaceXml)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'PLATFORM' },
        newKeywordObject: { ShortName: 'PLATFORM-2' },
        newLongName: 'Updated Long Name'
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // The keyword block should be updated
      expect(updatedXml).toContain('PLATFORM-2 &gt; Updated Long Name')

      // Acquisition code detects ' > ' and preserves combined format
      expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>PLATFORM-2 &gt; Updated Long Name<\/gco:CharacterString>/)
    })

    test('should handle empty string LongName', () => {
      const editor = new Iso19115MetadataPathEditor(mockIso19115WithNSIDCAcquisition)

      const correction = {
        scheme: 'platforms',
        action: 'replace',
        oldKeywordObject: { ShortName: 'ICESat-2' },
        newKeywordObject: { ShortName: 'ICESat-3' },
        newLongName: ''
      }

      const config = ISO_19115_SCHEME_EDITORS.platforms
      const success = config(editor, correction)

      expect(success).toBe(true)

      const updatedXml = editor.serialize()

      // Keyword block should have just ShortName when LongName is empty
      expect(updatedXml).toMatch(/<gmd:keyword>\s*<gco:CharacterString>ICESat-3<\/gco:CharacterString>/)
    })
  })
})

// Mock with BOTH keyword blocks AND NSIDC acquisition information
// Tests synchronization between the two sections for the same platforms
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
            <gco:CharacterString>TERRA &gt; Earth Observing System, TERRA (AM-1)</gco:CharacterString>
          </gmd:keyword>
          <gmd:keyword>
            <gco:CharacterString>AQUA &gt; Earth Observing System, AQUA</gco:CharacterString>
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
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <eos:EOS_Platform id="_TERRA">
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>TERRA</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.platformshortname</gco:CharacterString>
              </gmd:codeSpace>
              <gmd:description>
                <gco:CharacterString>Earth Observing System, TERRA (AM-1)</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>Earth Observation Satellites</gco:CharacterString>
          </gmi:description>
        </eos:EOS_Platform>
      </gmi:platform>
      <gmi:platform>
        <eos:EOS_Platform id="_AQUA">
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>AQUA</gco:CharacterString>
              </gmd:code>
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.platformshortname</gco:CharacterString>
              </gmd:codeSpace>
              <gmd:description>
                <gco:CharacterString>Earth Observing System, AQUA</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>Earth Observation Satellites</gco:CharacterString>
          </gmi:description>
        </eos:EOS_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

describe('Platform corrections with synchronized keyword blocks and acquisition information', () => {
  test('should update BOTH keyword block and acquisition sections for AQUA', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-2' },
      newLongName: 'Updated Earth Observing System, AQUA-2'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // 1. Verify keyword block updated
    expect(updatedXml).toContain('AQUA-2 &gt; Updated Earth Observing System, AQUA-2')
    expect(updatedXml).not.toContain('AQUA &gt; Earth Observing System, AQUA')

    // 2. Verify acquisition gmd:code updated (ShortName only in NSIDC split format)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA-2<\/gco:CharacterString>/)

    // 3. Verify acquisition identifier gmd:description updated (LongName only in NSIDC split format)
    expect(updatedXml).toMatch(/<gmd:MD_Identifier>[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA-2<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>Updated Earth Observing System, AQUA-2<\/gco:CharacterString>/)

    // 4. Verify TERRA remains unchanged in both sections
    expect(updatedXml).toContain('TERRA &gt; Earth Observing System, TERRA (AM-1)')
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>TERRA<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:description>\s*<gco:CharacterString>Earth Observing System, TERRA \(AM-1\)<\/gco:CharacterString>/)
  })

  test('should update BOTH sections for TERRA without affecting AQUA', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'TERRA' },
      newKeywordObject: { ShortName: 'TERRA-2' },
      newLongName: 'Updated Earth Observing System, TERRA-2 (AM-1)'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // 1. TERRA keyword updated
    expect(updatedXml).toContain('TERRA-2 &gt; Updated Earth Observing System, TERRA-2 (AM-1)')
    expect(updatedXml).not.toContain('TERRA &gt; Earth Observing System, TERRA (AM-1)')

    // 2. TERRA acquisition code updated
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>TERRA-2<\/gco:CharacterString>/)

    // 3. TERRA acquisition description updated
    expect(updatedXml).toMatch(/<gmd:MD_Identifier>[\s\S]*?<gmd:code>\s*<gco:CharacterString>TERRA-2<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>Updated Earth Observing System, TERRA-2 \(AM-1\)<\/gco:CharacterString>/)

    // 4. AQUA remains unchanged in both sections
    expect(updatedXml).toContain('AQUA &gt; Earth Observing System, AQUA')
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:description>\s*<gco:CharacterString>Earth Observing System, AQUA<\/gco:CharacterString>/)
  })

  test('should handle sequential updates to different platforms', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    // First update AQUA
    const aquaCorrection = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-NEW' },
      newLongName: 'New AQUA Description'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const aquaSuccess = config(editor, aquaCorrection)

    // Then update TERRA
    const terraCorrection = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'TERRA' },
      newKeywordObject: { ShortName: 'TERRA-NEW' },
      newLongName: 'New TERRA Description'
    }

    const terraSuccess = config(editor, terraCorrection)

    expect(aquaSuccess).toBe(true)
    expect(terraSuccess).toBe(true)

    const updatedXml = editor.serialize()

    // Both keyword blocks updated correctly
    expect(updatedXml).toContain('AQUA-NEW &gt; New AQUA Description')
    expect(updatedXml).toContain('TERRA-NEW &gt; New TERRA Description')

    // Both acquisition sections updated independently
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA-NEW<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>TERRA-NEW<\/gco:CharacterString>/)

    // Descriptions updated independently
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA-NEW<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>New AQUA Description<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>TERRA-NEW<\/gco:CharacterString>[\s\S]*?<gmd:description>\s*<gco:CharacterString>New TERRA Description<\/gco:CharacterString>/)
  })

  test('should preserve codeSpace when updating platforms', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-3' },
      newLongName: 'Earth Observing System, AQUA-3'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    config(editor, correction)

    const updatedXml = editor.serialize()

    // CodeSpace should remain unchanged
    expect(updatedXml).toContain('gov.nasa.esdis.umm.platformshortname')
    expect(updatedXml).toMatch(/<gmd:codeSpace>\s*<gco:CharacterString>gov.nasa.esdis.umm.platformshortname<\/gco:CharacterString>/)
  })

  test('should preserve platform-level gmi:description (not identifier description)', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-4' },
      newLongName: 'Updated System'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    config(editor, correction)

    const updatedXml = editor.serialize()

    // Platform-level description should be preserved
    expect(updatedXml).toContain('<gmi:description>\n            <gco:CharacterString>Earth Observation Satellites</gco:CharacterString>')
  })

  test('should handle platform with only ShortName update', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-5' }
      // No newLongName provided
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword should have just ShortName
    expect(updatedXml).toContain('<gco:CharacterString>AQUA-5</gco:CharacterString>')

    // Acquisition code should be updated
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA-5<\/gco:CharacterString>/)
  })

  test('should delete platform from BOTH keyword block and acquisition section', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'delete',
      oldKeywordObject: { ShortName: 'AQUA' }
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword block should not contain AQUA
    expect(updatedXml).not.toContain('AQUA &gt; Earth Observing System, AQUA')

    // TERRA keyword should remain
    expect(updatedXml).toContain('TERRA &gt; Earth Observing System, TERRA (AM-1)')

    // Acquisition section should still exist but AQUA platform should be removed
    expect(updatedXml).toContain('gmi:acquisitionInformation')
    expect(updatedXml).not.toContain('<eos:EOS_Platform id="_AQUA">')
    expect(updatedXml).not.toContain('AQUA</gco:CharacterString>')

    // TERRA should still be in acquisition section
    expect(updatedXml).toContain('<eos:EOS_Platform id="_TERRA">')
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>TERRA<\/gco:CharacterString>/)
  })

  test('should verify both platforms are independent in updates', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    // Update only AQUA
    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-MODIFIED' },
      newLongName: 'Modified AQUA'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    config(editor, correction)

    const updatedXml = editor.serialize()

    // AQUA keyword updated correctly
    expect(updatedXml).toContain('AQUA-MODIFIED &gt; Modified AQUA')

    // AQUA acquisition updated
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA-MODIFIED<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:description>\s*<gco:CharacterString>Modified AQUA<\/gco:CharacterString>/)

    // TERRA completely unchanged in both keyword and acquisition
    expect(updatedXml).toContain('TERRA &gt; Earth Observing System, TERRA (AM-1)')
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>TERRA<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:description>\s*<gco:CharacterString>Earth Observing System, TERRA \(AM-1\)<\/gco:CharacterString>/)
  })

  test('should handle empty LongName gracefully', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'TERRA' },
      newKeywordObject: { ShortName: 'TERRA-SIMPLE' },
      newLongName: ''
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword should be just ShortName when LongName is empty
    expect(updatedXml).toContain('<gco:CharacterString>TERRA-SIMPLE</gco:CharacterString>')

    // Should not create malformed "TERRA-SIMPLE > "
    expect(updatedXml).not.toContain('TERRA-SIMPLE &gt; ')

    // Verify acquisition gmd:description is empty string (line 255 coverage)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_TERRA">[\s\S]*?<gmd:description>\s*<gco:CharacterString><\/gco:CharacterString>/)
  })

  test('should handle undefined newLongName (not just empty string)', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-MINIMAL' }
      // NewLongName is completely omitted (undefined)
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword should be just ShortName when newLongName is undefined (line 188 coverage)
    expect(updatedXml).toContain('<gco:CharacterString>AQUA-MINIMAL</gco:CharacterString>')
    expect(updatedXml).not.toContain('AQUA-MINIMAL &gt;')

    // Verify acquisition code has only ShortName
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:code>\s*<gco:CharacterString>AQUA-MINIMAL<\/gco:CharacterString>/)

    // Verify acquisition description is empty string when newLongName is falsy (line 255 coverage)
    expect(updatedXml).toMatch(/<eos:EOS_Platform id="_AQUA">[\s\S]*?<gmd:description>\s*<gco:CharacterString><\/gco:CharacterString>/)
  })

  test('should preserve CWIC format free-text description when updating with combined format', () => {
    // This specifically tests line 269: return node?.textContent || ''
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
            <gco:CharacterString>SENTINEL-1A &gt; Sentinel-1A</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>SENTINEL-1A &gt; Sentinel-1A</gco:CharacterString>
              </gmd:code>
              <gmd:description>
                <gco:CharacterString>This is a custom free-text description that should be preserved in CWIC format</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
          <gmi:description>
            <gco:CharacterString>Sentinel-1 is an imaging radar mission providing continuous all-weather imagery</gco:CharacterString>
          </gmi:description>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(cwicXml)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'SENTINEL-1A' },
      newKeywordObject: { ShortName: 'SENTINEL-1B' },
      newLongName: 'Sentinel-1B'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword updated with combined format
    expect(updatedXml).toContain('SENTINEL-1B &gt; Sentinel-1B')

    // Acquisition code updated with combined format (detected ' > ')
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>SENTINEL-1B &gt; Sentinel-1B<\/gco:CharacterString>/)

    // CRITICAL: Free-text description should be PRESERVED (line 269 coverage)
    // This tests the fallback: return node?.textContent || ''
    expect(updatedXml).toContain('This is a custom free-text description that should be preserved in CWIC format')

    // Platform-level description also preserved
    expect(updatedXml).toContain('Sentinel-1 is an imaging radar mission providing continuous all-weather imagery')
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
            <gco:CharacterString>TEST-SAT &gt; Test Satellite</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>TEST-SAT &gt; Test Satellite</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(cwicXmlNoDesc)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'TEST-SAT' },
      newKeywordObject: { ShortName: 'TEST-SAT-2' },
      newLongName: 'Test Satellite Version 2'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Should handle gracefully even without description node (line 269: || '' fallback)
    expect(updatedXml).toContain('TEST-SAT-2 &gt; Test Satellite Version 2')
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>TEST-SAT-2 &gt; Test Satellite Version 2<\/gco:CharacterString>/)
  })

  test('should handle special characters in platform names', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-1/2' },
      newLongName: 'Earth & Space System (Test)'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Special characters should be preserved in keyword
    expect(updatedXml).toContain('AQUA-1/2 &gt; Earth &amp; Space System (Test)')

    // Special characters should be preserved in acquisition
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>AQUA-1\/2<\/gco:CharacterString>/)
  })

  test('should maintain XML structure integrity after updates', () => {
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithKeywordsAndAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'AQUA' },
      newKeywordObject: { ShortName: 'AQUA-FINAL' },
      newLongName: 'Final AQUA Version'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
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

  test('should detect combined format in acquisition code and update accordingly', () => {
    // Test coverage for: if (existingValue.includes(' > '))
    const xmlWithCombinedFormat = `
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
            <gco:CharacterString>NOAA-20 &gt; NOAA-20</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <eos:EOS_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>NOAA-20 &gt; NOAA-20</gco:CharacterString>
              </gmd:code>
              <gmd:description>
                <gco:CharacterString>Custom description text</gco:CharacterString>
              </gmd:description>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </eos:EOS_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(xmlWithCombinedFormat)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'NOAA-20' },
      newKeywordObject: { ShortName: 'NOAA-21' },
      newLongName: 'NOAA-21 Satellite'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword block updated
    expect(updatedXml).toContain('NOAA-21 &gt; NOAA-21 Satellite')

    // CRITICAL: Code should use combined format because existing code includes ' > '
    // This covers the if (existingValue.includes(' > ')) branch
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>NOAA-21 &gt; NOAA-21 Satellite<\/gco:CharacterString>/)

    // Description should be preserved (CWIC format)
    expect(updatedXml).toContain('Custom description text')
  })

  test('should use combined format with empty LongName when existing code has delimiter', () => {
    // Test coverage for: if (existingValue.includes(' > ')) with LongName being falsy
    // This tests: return LongName ? `${ShortName} > ${LongName}` : ShortName
    const xmlWithDelimiter = `
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
            <gco:CharacterString>GOES-16 &gt; Geostationary Operational Environmental Satellite-16</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>GOES-16 &gt; Geostationary Operational Environmental Satellite-16</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(xmlWithDelimiter)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'GOES-16' },
      newKeywordObject: { ShortName: 'GOES-17' }
      // No newLongName - testing the ternary with falsy LongName
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword block updated with just ShortName (no LongName provided)
    expect(updatedXml).toContain('<gco:CharacterString>GOES-17</gco:CharacterString>')

    // Code detected ' > ' in existing value, enters if branch
    // But LongName is falsy, so ternary returns just ShortName
    // This covers: const { ShortName } = correction.newKeywordObject
    // and: return LongName ? `${ShortName} > ${LongName}` : ShortName
    expect(updatedXml).toMatch(/<gmd:code>\s*<gco:CharacterString>GOES-17<\/gco:CharacterString>/)
  })

  test('should handle both EOS_Platform and MI_Platform with combined format detection', () => {
    // Test coverage for both namespace variants with includes(' > ') check
    const mixedXml = `
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
            <gco:CharacterString>METOP-A &gt; Meteorological Operational Satellite-A</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <eos:EOS_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>METOP-A &gt; Meteorological Operational Satellite-A</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </eos:EOS_Platform>
      </gmi:platform>
      <gmi:platform>
        <gmi:MI_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <gmd:code>
                <gco:CharacterString>METOP-A &gt; Meteorological Operational Satellite-A</gco:CharacterString>
              </gmd:code>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </gmi:MI_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(mixedXml)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'METOP-A' },
      newKeywordObject: { ShortName: 'METOP-B' },
      newLongName: 'Meteorological Operational Satellite-B'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    expect(success).toBe(true)

    const updatedXml = editor.serialize()

    // Keyword updated
    expect(updatedXml).toContain('METOP-B &gt; Meteorological Operational Satellite-B')

    // Both EOS_Platform and MI_Platform should detect ' > ' and use combined format
    expect(updatedXml).toMatch(/<eos:EOS_Platform>[\s\S]*?<gmd:code>\s*<gco:CharacterString>METOP-B &gt; Meteorological Operational Satellite-B<\/gco:CharacterString>/)
    expect(updatedXml).toMatch(/<gmi:MI_Platform>[\s\S]*?<gmd:code>\s*<gco:CharacterString>METOP-B &gt; Meteorological Operational Satellite-B<\/gco:CharacterString>/)
  })

  test('should handle unsupported action gracefully', () => {
    // This covers line 169: return false when action is neither 'delete' nor 'replace'
    const editor = new Iso19115MetadataPathEditor(mockIso19115WithNSIDCAcquisition)

    const correction = {
      scheme: 'platforms',
      action: 'invalid-action', // Unsupported action
      oldKeywordObject: { ShortName: 'ICESat-2' },
      newKeywordObject: { ShortName: 'ICESat-3' }
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    // Should return false for unsupported action
    expect(success).toBe(false)

    // XML should remain unchanged
    const updatedXml = editor.serialize()
    expect(updatedXml).toContain('ICESat-2')
    expect(updatedXml).not.toContain('ICESat-3')
  })

  test('should handle delete when identifier has no code nodes', () => {
    // This covers line 222: return false when identifier has no code nodes during delete
    const xmlWithMalformedIdentifier = `
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
            <gco:CharacterString>TEST-SAT &gt; Test Satellite</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <eos:EOS_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <!-- No gmd:code element - malformed -->
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.platformshortname</gco:CharacterString>
              </gmd:codeSpace>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </eos:EOS_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(xmlWithMalformedIdentifier)

    const correction = {
      scheme: 'platforms',
      action: 'delete',
      oldKeywordObject: { ShortName: 'TEST-SAT' }
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    // Should still succeed in deleting the keyword block
    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    // Keyword removed from descriptiveKeywords
    expect(updatedXml).not.toContain('TEST-SAT &gt; Test Satellite')
    // Malformed acquisition platform remains (no code node to match)
    expect(updatedXml).toContain('eos:EOS_Platform')
  })

  test('should handle replace when identifier has no code nodes', () => {
    // This covers line 305: return false when identifier has no code nodes during replace
    const xmlWithMalformedIdentifier = `
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
            <gco:CharacterString>TEST-SAT &gt; Test Satellite</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <gmi:platform>
        <eos:EOS_Platform>
          <gmi:identifier>
            <gmd:MD_Identifier>
              <!-- No gmd:code element - malformed -->
              <gmd:codeSpace>
                <gco:CharacterString>gov.nasa.esdis.umm.platformshortname</gco:CharacterString>
              </gmd:codeSpace>
            </gmd:MD_Identifier>
          </gmi:identifier>
        </eos:EOS_Platform>
      </gmi:platform>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(xmlWithMalformedIdentifier)

    const correction = {
      scheme: 'platforms',
      action: 'replace',
      oldKeywordObject: { ShortName: 'TEST-SAT' },
      newKeywordObject: { ShortName: 'NEW-SAT' },
      newLongName: 'New Satellite'
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms
    const success = config(editor, correction)

    // Should still succeed in updating the keyword block
    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    // Keyword updated in descriptiveKeywords
    expect(updatedXml).toContain('NEW-SAT &gt; New Satellite')
    // Malformed acquisition platform remains unchanged (no code node to match)
    expect(updatedXml).toContain('eos:EOS_Platform')
    expect(updatedXml).not.toContain('NEW-SAT</gco:CharacterString>')
  })

  test('should break when reaching document root during delete navigation', () => {
    // This covers line 246: break when currentNode === this.document.documentElement
    // Create XML where MD_Identifier is in an unexpected location (not properly nested in EOS_Platform/MI_Platform)
    const xmlWithShallowIdentifier = `
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
            <gco:CharacterString>ORPHAN-SAT &gt; Orphan Satellite</gco:CharacterString>
          </gmd:keyword>
          <gmd:type>
            <gmd:MD_KeywordTypeCode codeListValue="platform">platform</gmd:MD_KeywordTypeCode>
          </gmd:type>
        </gmd:MD_Keywords>
      </gmd:descriptiveKeywords>
    </gmd:MD_DataIdentification>
  </gmd:identificationInfo>
  <gmi:acquisitionInformation>
    <gmi:MI_AcquisitionInformation>
      <!-- MD_Identifier directly under MI_AcquisitionInformation without proper platform wrapper -->
      <gmd:MD_Identifier>
        <gmd:code>
          <gco:CharacterString>ORPHAN-SAT</gco:CharacterString>
        </gmd:code>
        <gmd:codeSpace>
          <gco:CharacterString>gov.nasa.esdis.umm.platformshortname</gco:CharacterString>
        </gmd:codeSpace>
      </gmd:MD_Identifier>
    </gmi:MI_AcquisitionInformation>
  </gmi:acquisitionInformation>
</gmi:MI_Metadata>`

    const editor = new Iso19115MetadataPathEditor(xmlWithShallowIdentifier)

    const correction = {
      scheme: 'platforms',
      action: 'delete',
      oldKeywordObject: { ShortName: 'ORPHAN-SAT' }
    }

    const config = ISO_19115_SCHEME_EDITORS.platforms

    // The delete operation should find the identifier matching 'ORPHAN-SAT'
    // When navigating up from MD_Identifier, it will check:
    // - parentNode = MI_AcquisitionInformation (localName !== EOS_Platform/MI_Platform)
    // - parentNode = acquisitionInformation (localName !== EOS_Platform/MI_Platform)
    // - parentNode = MI_Metadata (this IS document.documentElement)
    // Line 246: break is hit when currentNode === this.document.documentElement
    const success = config(editor, correction)
    expect(success).toBe(true)

    const updatedXml = editor.serialize()
    // Keyword should be deleted
    expect(updatedXml).not.toContain('ORPHAN-SAT &gt; Orphan Satellite')
    // Orphan MD_Identifier remains because navigation hit document root without finding platform wrapper
    expect(updatedXml).toContain('ORPHAN-SAT</gco:CharacterString>')
  })
})
