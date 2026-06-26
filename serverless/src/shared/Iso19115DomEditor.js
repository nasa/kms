import Iso19115MetadataPathEditor from './Iso19115MetadataPathEditor'
import { FULL_PATH_VALUE_FIELDS } from './redis-path-store/helpers/constants'

/**
 * Helper factory function to create a block editor configuration.
 * Maps a correction to an update operation within the editor instance.
 */
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)

const leafScheme = (config) => (editor, correction) => editor.updateLeafNode(correction, config)

/**
 * Factory to generate hierarchical keyword block editors
 * (like Science Keywords and Locations).
 */
const createHierarchicalKeywordBlock = (keywordTypeCode, fieldKeys) => blockScheme({
  nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
    gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = '${keywordTypeCode}'
  ]`,
  find: {
    fieldPaths: ['gco:CharacterString'],
    valueKeys: fieldKeys,
    getNodeValueObject: ({ node, editor, fieldPaths }) => {
      const fullString = editor.getNestedText(node, fieldPaths[0]) || ''
      const parts = fullString.split(' > ').map((s) => s.trim())
      const fields = fieldKeys

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
          const fields = fieldKeys

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
const createKeywordBlock = (keywordTypeCode) => blockScheme({
  nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
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
 * Factory to generate standardized keyword block editors for structures
 * like Platforms and Instruments.
 */
const createProviderEditor = () => blockScheme({
  nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords
  [
    gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'dataCentre'
  ]`,
  find: {
    fieldPaths: ['gmx:Anchor', 'gco:CharacterString'], // Changed paths to be relative to <gmd:keyword>
    valueKeys: ['ShortName', 'LongName'],
    getNodeValueObject: ({ node, editor }) => {
      // Directly extract the text from the child elements
      const anchorNode = editor.selectNodes('./gmx:Anchor', node)[0]
      const charStringNode = editor.selectNodes('./gco:CharacterString', node)[0]

      const fullString = (anchorNode ? anchorNode.textContent : '')
                     || (charStringNode ? charStringNode.textContent : '') || ''

      const [ShortName, ...longNameParts] = fullString.split(' > ')

      return {
        ShortName: ShortName?.trim() || '',
        LongName: longNameParts.join(' > ').trim() || ''
      }
    }
  },
  replace: [
    {
      fieldPath: ({ node, editor }) => (editor.selectNodes('./gmx:Anchor', node).length > 0
        ? 'gmx:Anchor'
        : 'gco:CharacterString'),
      source: {
        type: 'computed',
        getValue: ({ correction }) => {
          const { ShortName } = correction.newKeywordObject
          const LongName = correction.newLongName || ''

          return LongName ? `${ShortName} > ${LongName}` : ShortName
        }
      }
    }
  ]
})

const createIsoTopicCategoryEditor = () => leafScheme({
  nodeXPath: '//gmd:identificationInfo/gmd:MD_DataIdentification/gmd:topicCategory',
  find: {
    getNodeValueObject: ({ node }) => ({ Value: node.textContent?.trim() || '' })
  },
  replace: [
    {
      // 1. Update the visible text content
      fieldPath: 'gmd:MD_TopicCategoryCode',
      source: {
        type: 'computed',
        getValue: ({ correction }) => correction.newKeywordObject.Value
      }
    },
    {
      // 2. Update the codeListValue attribute
      fieldPath: 'gmd:MD_TopicCategoryCode/@codeListValue',
      source: {
        type: 'computed',
        getValue: ({ correction }) => correction.newKeywordObject.Value
      }
    }
  ]
})

const createProductLevelIdEditor = () => leafScheme({
  nodeXPath: '//gmd:processingLevel/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]',
  find: {
    getNodeValueObject: ({ node, editor }) => ({
      Value: editor.getNestedText(node, 'gmd:code/gco:CharacterString')?.trim() || ''
    })
  },
  delete: [
    // Define the paths to remove both occurrences
    { path: '//gmd:processingLevel/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]' },
    { path: '//gmd:processingLevelCode/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]' }
  ],
  replace: [
    {
      // Since matchingNode is now MD_Identifier, this path correctly selects the child
      fieldPath: 'gmd:code/gco:CharacterString',
      source: {
        type: 'computed',
        getValue: ({ correction }) => correction.newKeywordObject.Value
      }
    },
    {
      fieldPath: '//gmd:contentInfo/gmd:MD_ImageDescription/gmd:processingLevelCode/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]/gmd:code/gco:CharacterString',
      source: {
        type: 'computed',
        getValue: ({ correction }) => correction.newKeywordObject.Value
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
    'theme',
    FULL_PATH_VALUE_FIELDS.sciencekeywords
  ),

  locations: createHierarchicalKeywordBlock(
    'place',
    FULL_PATH_VALUE_FIELDS.locations
  ),

  platforms: createKeywordBlock('platform'),

  instruments: createKeywordBlock('instrument'),

  projects: createKeywordBlock('project'),

  isotopiccategory: createIsoTopicCategoryEditor(),

  productlevelid: createProductLevelIdEditor(),

  providers: createProviderEditor()

  /*
  Providers: short name not in examples
              <gmd:organisationName>
                <gco:CharacterString>National Snow and Ice Data Center</gco:CharacterString>
              </gmd:organisationName>
  rucontenttype: TBD
  idnnode: no mapping
  */
}

/**
 * Creates a DOM-backed editor for a raw ISO 19115 XML payload.
 *
 * @param {string} payload Raw ISO 19115 XML string.
 * @returns {Iso19115Editor} Specialized ISO 19115 XML path editor instance.
 */
export const createIso19115Editor = (payload) => new Iso19115MetadataPathEditor(payload)

export default ISO_19115_SCHEME_EDITORS
