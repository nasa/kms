import Iso19115MetadataPathEditor from './Iso19115MetadataPathEditor'
import { FULL_PATH_VALUE_FIELDS } from './redis-path-store/helpers/constants'

/**
 * Helper factory function to create a block editor configuration.
 * Maps a correction to an update operation within the editor instance.
 */
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)

/**
 * Factory to generate hierarchical keyword block editors
 * (like Science Keywords and Locations).
 */
const createHierarchicalKeywordBlock = (thesaurusTitle, keywordTypeCode, fieldKey) => blockScheme({
  nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
    gmd:thesaurusName/gmd:CI_Citation/gmd:title/gco:CharacterString = '${thesaurusTitle}'
    or
    gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = '${keywordTypeCode}'
  ]`,
  find: {
    fieldPaths: ['gco:CharacterString'],
    valueKeys: FULL_PATH_VALUE_FIELDS[fieldKey],
    getNodeValueObject: ({ node, editor, fieldPaths }) => {
      const fullString = editor.getNestedText(node, fieldPaths[0]) || ''
      const parts = fullString.split(' > ').map((s) => s.trim())
      const fields = FULL_PATH_VALUE_FIELDS[fieldKey]

      const obj = fields.reduce((acc, field, index) => {
        acc[field] = parts[index] || ''

        return acc
      }, {})

      obj.Value = fullString.trim()

      return obj
    }
  },
  replace: [
    {
      fieldPath: 'gmd:keyword/gco:CharacterString',
      source: {
        type: 'computed',
        getValue: ({ correction }) => {
          const k = correction.newKeywordObject
          const fields = FULL_PATH_VALUE_FIELDS[fieldKey]

          return fields
            .map((field) => k[field] || '')
            .filter((v) => v.trim().length > 0)
            .join(' > ')
        }
      }
    }
  ]
})

/**
 * Factory to generate standardized keyword block editors for structures
 * like Platforms and Instruments.
 */
const createKeywordBlock = (thesaurusTitle, keywordTypeCode) => blockScheme({
  nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
    gmd:thesaurusName/gmd:CI_Citation/gmd:title/gco:CharacterString = '${thesaurusTitle}'
    or
    gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = '${keywordTypeCode}'
  ]`,
  find: {
    fieldPaths: ['gco:CharacterString'],
    valueKeys: ['ShortName', 'LongName'],
    getNodeValueObject: ({ node, editor, fieldPaths }) => {
      const fullString = editor.getNestedText(node, fieldPaths[0]) || ''
      const [ShortName, ...longNameParts] = fullString.split(' > ')

      return {
        ShortName: ShortName?.trim() || '',
        LongName: longNameParts.join(' > ').trim() || ''
      }
    }
  },
  replace: [
    {
      fieldPath: 'gmd:keyword/gco:CharacterString',
      source: {
        type: 'computed',
        getValue: ({ correction }) => {
          const { ShortName } = correction.newKeywordObject
          const LongName = correction.newLongName

          return `${ShortName} > ${LongName}`
        }
      }
    }
  ]
})

/**
 * ISO 19115 scheme configuration.
 * Defines how to identify, parse, and update specific keyword blocks (e.g., science keywords, platforms)
 * within an ISO 19115 XML structure using XPath selectors and transformation logic.
 */
export const ISO_19115_SCHEME_EDITORS = {
  sciencekeywords: createHierarchicalKeywordBlock(
    'NASA / GCMD Science Keywords',
    'theme',
    'sciencekeywords'
  ),

  locations: createHierarchicalKeywordBlock(
    'NASA / GCMD Location Keywords',
    'place',
    'locations'
  ),

  platforms: createKeywordBlock('NASA / GCMD Platform Keywords', 'platform'),

  instruments: createKeywordBlock('NASA / GCMD Instrument Keywords', 'instrument'),

  projects: createKeywordBlock('NASA / GCMD Project Keywords', 'project')
}

/**
 * Creates a DOM-backed editor for a raw ISO 19115 XML payload.
 *
 * @param {string} payload Raw ISO 19115 XML string.
 * @returns {Iso19115Editor} Specialized ISO 19115 XML path editor instance.
 */
export const createIso19115Editor = (payload) => new Iso19115MetadataPathEditor(payload)

export default ISO_19115_SCHEME_EDITORS
