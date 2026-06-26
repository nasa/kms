import Iso19115MetadataPathEditor from './Iso19115MetadataPathEditor'
import { FULL_PATH_VALUE_FIELDS } from './redis-path-store/helpers/constants'

/**
 * Helper factory function to create a block editor configuration.
 * Maps a correction to an update operation within the editor instance.
 */
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)

const leafScheme = (config) => (editor, correction) => editor.updateLeafNode(correction, config)

/**
 * Factory to generate standardized keyword block editors for structures
 * like Platforms and Instruments.
 */
const createKeywordBlock = (type, { fieldKeys, matchKeys, getValue }) => blockScheme({
  nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords[gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = '${type}']`,
  find: {
    fieldPaths: ['gmx:Anchor', 'gco:CharacterString'],
    valueKeys: fieldKeys,
    matchKeys,
    getNodeValueObject: ({ node, editor }) => {
      const anchorNode = editor.selectNodes('./gmx:Anchor', node)[0]
      const charStringNode = editor.selectNodes('./gco:CharacterString', node)[0]

      const fullString = (anchorNode || charStringNode)?.textContent || ''
      // Parsing logic: Hierarchical (l1 > l2) or Simple (short > long)
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
        // Use the custom getValue if provided, else fall back to default
        getValue: getValue || (({ correction }) => fieldKeys.map((k) => correction.newKeywordObject[k]).filter(Boolean).join(' > '))
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
  sciencekeywords: createKeywordBlock(
    'theme',
    {
      fieldKeys: FULL_PATH_VALUE_FIELDS.sciencekeywords,
      matchKeys: ['Value']
    }
  ),

  locations: createKeywordBlock(
    'place',
    {
      fieldKeys: FULL_PATH_VALUE_FIELDS.locations,
      matchKeys: ['Value']
    }
  ),

  platforms: createKeywordBlock('platform', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  }),

  instruments: createKeywordBlock('instrument', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  }),

  projects: createKeywordBlock('project', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  }),

  isotopiccategory: createIsoTopicCategoryEditor(),

  productlevelid: createProductLevelIdEditor(),

  providers: createKeywordBlock('dataCentre', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
  })

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
