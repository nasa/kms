import Iso19115MetadataPathEditor from './Iso19115MetadataPathEditor'
import { FULL_PATH_VALUE_FIELDS } from './redis-path-store/helpers/constants'

/**
 * A list of authorized domains used to validate the 'codeList' attribute
 * within MD_KeywordTypeCode elements. This ensures only keywords originating
 * from trusted metadata authorities are processed by the editor.
 */
const KEYWORD_DOMAINS = [
  'cdn.earthdata.nasa.gov', // NASA Earthdata Resource Codelists
  'www.isotc211.org', // ISO TC 211 Standard Codelists
  'data.noaa.gov' // NOAA Metadata Authority Codelists
]

/**
 * Helper factory function to create a block editor configuration.
 * Maps a correction to an update operation within the editor instance.
 * @param {Object} config - Configuration object defining XPath and transformation logic.
 * @returns {Function} Function to apply the update.
 */
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)
/**
 * Helper factory function to create a leaf editor configuration.
 * @param {Object} config - Configuration object for updating single nodes.
 * @returns {Function} Function to apply the update.
 */
const leafScheme = (config) => (editor, correction) => editor.updateLeafNode(correction, config)
/**
 * Factory to generate standardized keyword block editors.
 * @param {string} type - The 'codeListValue' for the MD_KeywordTypeCode.
 * @param {Object} options - Configuration options.
 * @param {string[]} options.allowedCodelistDomains - List of domains (e.g., ['cdn.earthdata.nasa.gov', 'noaa.gov']).
 */
const createKeywordBlock = (type, {
  fieldKeys, matchKeys, getValue, allowedCodelistDomains = []
}) => {
  // Construct the XPath predicate to check if the codeList contains any of the allowed domains
  const domainConditions = allowedCodelistDomains
    .map((domain) => `contains(gmd:type/gmd:MD_KeywordTypeCode/@codeList, '${domain}')`)
    .join(' or ')

  const predicate = domainConditions ? `and (${domainConditions})` : ''

  return blockScheme({
    nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords[
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = '${type}' 
      ${predicate}
    ]`.replace(/\s+/g, ' '),

    find: {
      fieldPaths: ['gmx:Anchor', 'gco:CharacterString'],
      valueKeys: fieldKeys,
      matchKeys,
      getNodeValueObject: ({ node, editor }) => {
        const anchorNode = editor.selectNodes('./gmx:Anchor', node)[0]
        const charStringNode = editor.selectNodes('./gco:CharacterString', node)[0]
        const fullString = (anchorNode || charStringNode)?.textContent || ''
        const parts = fullString.split(' > ').map((s) => s.trim())

        return fieldKeys.reduce((acc, key, index) => {
          acc[key] = parts[index] || ''

          return acc
        }, { Value: fullString.trim() })
      }
    },
    replace: [
      {
        fieldPath: ({ node, editor }) => (editor.selectNodes('./gmx:Anchor', node).length > 0 ? 'gmx:Anchor' : 'gco:CharacterString'),
        source: {
          type: 'computed',
          getValue: getValue || (({ correction }) => fieldKeys.map((k) => correction.newKeywordObject[k]).filter(Boolean).join(' > '))
        }
      }
    ]
  })
}

/**
 * Creates an editor for ISO Topic Category nodes.
 * Updates both the text content and the @codeListValue attribute.
 */
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
/**
 * Creates an editor for Processing Level Identifiers.
 * Manages deletion of old paths and insertion/updates into specific XML locations.
 */
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
      fieldPath: 'gmd:code/gco:CharacterString',
      source: {
        type: 'computed',
        getValue: ({ correction }) => correction.newKeywordObject.Value
      }
    },
    {
      // Target specific secondary locations for synchronization
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
  sciencekeywords: createKeywordBlock(
    'theme',
    {
      fieldKeys: FULL_PATH_VALUE_FIELDS.sciencekeywords,
      matchKeys: FULL_PATH_VALUE_FIELDS.sciencekeywords,
      allowedCodelistDomains: KEYWORD_DOMAINS
    }
  ),

  locations: createKeywordBlock(
    'place',
    {
      fieldKeys: FULL_PATH_VALUE_FIELDS.locations,
      matchKeys: FULL_PATH_VALUE_FIELDS.locations,
      allowedCodelistDomains: KEYWORD_DOMAINS
    }
  ),

  platforms: createKeywordBlock('platform', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    allowedCodelistDomains: KEYWORD_DOMAINS,
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  }),

  instruments: createKeywordBlock('instrument', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    allowedCodelistDomains: KEYWORD_DOMAINS,
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  }),

  projects: createKeywordBlock('project', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    allowedCodelistDomains: KEYWORD_DOMAINS,
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  }),

  providers: createKeywordBlock('dataCentre', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    allowedCodelistDomains: KEYWORD_DOMAINS,
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  }),

  isotopiccategory: createIsoTopicCategoryEditor(),

  productlevelid: createProductLevelIdEditor()
}

/**
 * Creates a DOM-backed editor for a raw ISO 19115 XML payload.
 *
 * @param {string} payload Raw ISO 19115 XML string.
 * @returns {Iso19115Editor} Specialized ISO 19115 XML path editor instance.
 */
export const createIso19115Editor = (payload) => new Iso19115MetadataPathEditor(payload)

export default ISO_19115_SCHEME_EDITORS
