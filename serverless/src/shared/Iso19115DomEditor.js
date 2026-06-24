import Iso19115MetadataPathEditor from './Iso19115MetadataPathEditor'
import { FULL_PATH_VALUE_FIELDS } from './redis-path-store/helpers/constants'

/**
 * Helper factory function to create a block editor configuration.
 * Maps a correction to an update operation within the editor instance.
 */
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)

/**
 * ISO 19115 scheme configuration.
 * Defines how to identify, parse, and update specific keyword blocks (e.g., science keywords, platforms)
 * within an ISO 19115 XML structure using XPath selectors and transformation logic.
 */
export const ISO_19115_SCHEME_EDITORS = {
  sciencekeywords: blockScheme({
    // XPath to locate MD_Keywords nodes based on specific thesaurus title or type
    nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
    gmd:thesaurusName/gmd:CI_Citation/gmd:title/gco:CharacterString = 'NASA / GCMD Science Keywords'
    or
    gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'theme'
  ]`,
    find: {
      fieldPaths: ['gco:CharacterString'],
      valueKeys: FULL_PATH_VALUE_FIELDS.sciencekeywords,
      // Parses the XML node into a structured object
      getNodeValueObject: ({ node, editor, fieldPaths }) => {
        const fullString = editor.getNestedText(node, fieldPaths[0]) || ''
        // Splits hierarchical keywords (e.g., "Level 1 > Level 2") into array components
        const parts = fullString.split(' > ').map((s) => s.trim())
        const fields = FULL_PATH_VALUE_FIELDS.sciencekeywords
        // Map split parts to defined schema fields
        const obj = fields.reduce((acc, field, index) => {
          acc[field] = parts[index] || ''

          return acc
        }, {})

        obj.Value = fullString.trim()// Keep original full string as 'Value'

        return obj
      }
    },
    // Defines how to serialize the updated object back into the XML structure
    replace: [
      {
        fieldPath: 'gmd:keyword/gco:CharacterString',
        source: {
          type: 'computed',
          getValue: ({ correction }) => {
            const k = correction.newKeywordObject
            const fields = FULL_PATH_VALUE_FIELDS.sciencekeywords

            // Reconstructs the hierarchical string from object fields, ignoring empty ones
            return fields
              .map((field) => k[field] || '')
              .filter((v) => v.trim().length > 0)
              .join(' > ')
          }
        }
      }
    ]
  }),

  platforms: blockScheme({
    // XPath to locate MD_Keywords specific to platforms
    nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
    gmd:thesaurusName/gmd:CI_Citation/gmd:title/gco:CharacterString = 'NASA / GCMD Platform Keywords'
    or
    gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'platform'
  ]`,
    find: {
      fieldPaths: ['gco:CharacterString'],
      valueKeys: ['ShortName', 'LongName'],
      // Parses platform string: "ShortName > LongName"
      getNodeValueObject: ({ node, editor, fieldPaths }) => {
        const fullString = editor.getNestedText(node, fieldPaths[0]) || ''
        const [ShortName, ...longNameParts] = fullString.split(' > ')

        return {
          ShortName: ShortName?.trim() || '',
          LongName: longNameParts.join(' > ').trim() || ''
        }
      }
    },
    // Reconstructs platform string for XML update
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
  }),

  instruments: blockScheme({
    // XPath to locate MD_Keywords specific to instruments
    nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
    gmd:thesaurusName/gmd:CI_Citation/gmd:title/gco:CharacterString = 'NASA / GCMD Instrument Keywords'
    or
    gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'instrument'
  ]`,
    find: {
      fieldPaths: ['gco:CharacterString'],
      valueKeys: ['ShortName', 'LongName'],
      // Parses instrument string: "ShortName > LongName"
      getNodeValueObject: ({ node, editor, fieldPaths }) => {
        const fullString = editor.getNestedText(node, fieldPaths[0]) || ''
        const [ShortName, ...longNameParts] = fullString.split(' > ')

        return {
          ShortName: ShortName?.trim() || '',
          LongName: longNameParts.join(' > ').trim() || ''
        }
      }
    },
    // Reconstructs instrument string for XML update
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
}

/**
 * Creates a DOM-backed editor for a raw ISO 19115 XML payload.
 *
 * @param {string} payload Raw ISO 19115 XML string.
 * @returns {Iso19115Editor} Specialized ISO 19115 XML path editor instance.
 */
export const createIso19115Editor = (payload) => new Iso19115MetadataPathEditor(payload)

export default ISO_19115_SCHEME_EDITORS
