import Iso19115MetadataPathEditor from './Iso19115MetadataPathEditor'
import { FULL_PATH_VALUE_FIELDS } from './redis-path-store/helpers/constants'

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
 * @param {Array} [options.additionalPaths] - Optional array of XPath strings for secondary sync.
 */
const createKeywordBlock = (type, {
  fieldKeys, matchKeys, getValue, additionalPaths = [], nodeXPath
}) => blockScheme({
  nodeXPath: nodeXPath || `//gmd:descriptiveKeywords/gmd:MD_Keywords[
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = '${type}' 
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
        getValue: getValue || (({ correction }) => fieldKeys
          .map((k) => correction.newKeywordObject[k] || 'NONE')
          .join(' > ')
        )
      }
    },
    // Dynamically add secondary paths for synchronization
    // Each path can be a string or an object with { path, getValue }
    ...additionalPaths.map((pathConfig) => {
      const isObject = typeof pathConfig === 'object' && pathConfig.path
      const path = isObject ? pathConfig.path : pathConfig
      const pathGetValue = isObject ? pathConfig.getValue : null

      return {
        fieldPath: path,
        source: {
          type: 'computed',
          getValue: pathGetValue || getValue || (({ correction }) => fieldKeys
            .map((k) => correction.newKeywordObject[k] || 'NONE')
            .join(' > '))
        }
      }
    })
  ]
})

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
    // Remove the entire processingLevel parent wrapper (in identificationInfo)
    { path: '//gmd:identificationInfo//gmd:processingLevel[gmd:MD_Identifier/gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]' },
    // Remove the entire processingLevelCode parent wrapper (in contentInfo)
    { path: '//gmd:contentInfo//gmd:processingLevelCode[gmd:MD_Identifier/gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]' }
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
      matchKeys: FULL_PATH_VALUE_FIELDS.sciencekeywords
    }
  ),

  locations: createKeywordBlock(
    'place',
    {
      fieldKeys: FULL_PATH_VALUE_FIELDS.locations,
      matchKeys: FULL_PATH_VALUE_FIELDS.locations,
      nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords[
        gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'place' or 
        gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'theme'
      ]`.replace(/\s+/g, ' ')
    }
  ),

  platforms: createKeywordBlock('platform', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords[
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'platform' or
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'theme'
    ]`.replace(/\s+/g, ' '),
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    },
    // Sync with acquisition information section
    // Smart detection: if gmd:code contains ' > ', use combined format (CWIC style)
    // Otherwise use split format (NSIDC/NOAA style)
    additionalPaths: [
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/eos:EOS_Platform/gmi:identifier/gmd:MD_Identifier/gmd:code/gco:CharacterString',
        getValue: ({ correction, node }) => {
          const existingValue = node?.textContent || ''
          // If existing value contains ' > ', keep combined format
          if (existingValue.includes(' > ')) {
            const { ShortName } = correction.newKeywordObject
            const LongName = correction.newLongName || ''

            return LongName ? `${ShortName} > ${LongName}` : ShortName
          }

          // Otherwise use ShortName only (NSIDC/NOAA format)
          return correction.newKeywordObject.ShortName
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/gmi:MI_Platform/gmi:identifier/gmd:MD_Identifier/gmd:code/gco:CharacterString',
        getValue: ({ correction, node }) => {
          const existingValue = node?.textContent || ''
          if (existingValue.includes(' > ')) {
            const { ShortName } = correction.newKeywordObject
            const LongName = correction.newLongName || ''

            return LongName ? `${ShortName} > ${LongName}` : ShortName
          }

          return correction.newKeywordObject.ShortName
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/eos:EOS_Platform/gmi:identifier/gmd:MD_Identifier/gmd:description/gco:CharacterString',
        getValue: ({ correction, node, editor }) => {
          const codeNode = editor.selectNodes('../gmd:code/gco:CharacterString', node.parentNode)[0]
          const codeValue = codeNode?.textContent || ''
          // Only update description if code uses split format (doesn't contain ' > ')
          if (!codeValue.includes(' > ')) {
            return correction.newLongName || ''
          }

          // For CWIC format, preserve existing free-text description
          return node?.textContent || ''
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/gmi:MI_Platform/gmi:identifier/gmd:MD_Identifier/gmd:description/gco:CharacterString',
        getValue: ({ correction, node, editor }) => {
          const codeNode = editor.selectNodes('../gmd:code/gco:CharacterString', node.parentNode)[0]
          const codeValue = codeNode?.textContent || ''
          if (!codeValue.includes(' > ')) {
            return correction.newLongName || ''
          }

          return node?.textContent || ''
        }
      }
    ]
  }),

  instruments: createKeywordBlock('instrument', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    nodeXPath: `//gmd:descriptiveKeywords/gmd:MD_Keywords[
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'instrument' or 
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'theme'
    ]`.replace(/\s+/g, ' '),
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    },
    // Sync with acquisition information section
    // Smart detection: if gmd:code contains ' > ', use combined format (CWIC style)
    // Otherwise use split format (NSIDC/NOAA style)
    additionalPaths: [
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:instrument/eos:EOS_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:code/gco:CharacterString',
        getValue: ({ correction, node }) => {
          const existingValue = node?.textContent || ''
          if (existingValue.includes(' > ')) {
            const { ShortName } = correction.newKeywordObject
            const LongName = correction.newLongName || ''

            return LongName ? `${ShortName} > ${LongName}` : ShortName
          }

          return correction.newKeywordObject.ShortName
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:instrument/gmi:MI_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:code/gco:CharacterString',
        getValue: ({ correction, node }) => {
          const existingValue = node?.textContent || ''
          if (existingValue.includes(' > ')) {
            const { ShortName } = correction.newKeywordObject
            const LongName = correction.newLongName || ''

            return LongName ? `${ShortName} > ${LongName}` : ShortName
          }

          return correction.newKeywordObject.ShortName
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:instrument/eos:EOS_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:description/gco:CharacterString',
        getValue: ({ correction, node, editor }) => {
          const codeNode = editor.selectNodes('../gmd:code/gco:CharacterString', node.parentNode)[0]
          const codeValue = codeNode?.textContent || ''
          if (!codeValue.includes(' > ')) {
            return correction.newLongName || ''
          }

          return node?.textContent || ''
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:instrument/gmi:MI_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:description/gco:CharacterString',
        getValue: ({ correction, node, editor }) => {
          const codeNode = editor.selectNodes('../gmd:code/gco:CharacterString', node.parentNode)[0]
          const codeValue = codeNode?.textContent || ''
          if (!codeValue.includes(' > ')) {
            return correction.newLongName || ''
          }

          return node?.textContent || ''
        }
      }
    ]
  }),

  projects: createKeywordBlock('project', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    // Use | to support both MENDS (standard) and SMAP (wrapped) formats
    nodeXPath: `(
    //gmd:descriptiveKeywords/gmd:MD_Keywords[
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = 'project'
    ]
    |
    //gmd:aggregationInfo/gmd:MD_AggregateInformation[
      gmd:initiativeType/gmd:DS_InitiativeTypeCode/@codeListValue = 'mission'
    ]
  )`.replace(/\s+/g, ' '),
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    },
    // Sync with acquisition information section (gmi:MI_Operation)
    additionalPaths: [
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:operation/gmi:MI_Operation/gmi:identifier/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.projectshortname"]/gmd:code/gco:CharacterString',
        getValue: ({ correction }) => {
          const { ShortName } = correction.newKeywordObject
          const LongName = correction.newLongName || ''

          return LongName ? `${ShortName} > ${LongName}` : ShortName
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:operation/gmi:MI_Operation/gmi:identifier/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.projectshortname"]/gmd:description/gco:CharacterString',
        getValue: ({ correction }) => correction.newLongName || ''
      }
    ]
  }),

  providers: createKeywordBlock('dataCentre', {
    fieldKeys: ['ShortName', 'LongName'],
    matchKeys: ['ShortName'],
    getValue: ({ correction }) => {
      const { ShortName } = correction.newKeywordObject
      const LongName = correction.newLongName || ''

      return LongName ? `${ShortName} > ${LongName}` : ShortName
    }
    // Additional paths
    // additionalPaths: [
    //   '//gmd:CI_ResponsibleParty/gmd:organisationName/gco:CharacterString'
    // ]
  }),

  isotopiccategory: createIsoTopicCategoryEditor(),

  productlevelid: createProductLevelIdEditor()
}

/**
 * Creates a DOM-backed editor for a raw ISO 19115 XML payload.
 *
 * @param {string} payload Raw ISO 19115 XML string.
 * @param {object} [options] Editor configuration options.
 * @param {string} [options.format] Format type: 'MENDS' or 'SMAP'. Auto-detected if not provided.
 * @returns {Iso19115Editor} Specialized ISO 19115 XML path editor instance.
 */
// eslint-disable-next-line max-len
export const createIso19115Editor = (payload, options = {}) => new Iso19115MetadataPathEditor(payload, options)

export default ISO_19115_SCHEME_EDITORS
