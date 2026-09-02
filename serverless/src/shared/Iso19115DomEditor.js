import Iso19115MetadataPathEditor from './Iso19115MetadataPathEditor'
import { CSV_FIELDS, ISO19115_FIELDS } from './redis-path-store/helpers/constants'

/**
 * Helper factory function to create a block editor configuration.
 * Maps a correction to an update operation within the editor instance.
 * @param {Object} config - Configuration object defining XPath, search, and transformation logic.
 * @returns {Function} Function to apply the update.
 */
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)

/**
 * Helper factory function to create a leaf editor configuration.
 * Designed for updating single node values rather than complex blocks.
 * @param {Object} config - Configuration object for updating single nodes, including XPath and replace logic.
 * @returns {Function} Function to apply the update.
 */
const leafScheme = (config) => (editor, correction) => editor.updateLeafNode(correction, config)

/**
 * Builds an ISO keyword path, using NONE only for gaps before a later populated level.
 *
 * @param {string[]} fieldKeys Ordered keyword hierarchy fields.
 * @param {Object} keywordObject Keyword values keyed by hierarchy field.
 * @returns {string} Serialized ISO keyword path.
 */
const buildKeywordPath = (fieldKeys, keywordObject = {}) => {
  const values = fieldKeys.map((key) => String(keywordObject[key] || '').trim())
  const lastValueIndex = values.reduce(
    (lastIndex, value, index) => (value ? index : lastIndex),
    -1
  )

  return values
    .slice(0, lastValueIndex + 1)
    .map((value) => value || 'NONE')
    .join(' > ')
}

/**
 * Factory to generate standardized keyword block editors.
 * @param {string} type - The 'codeListValue' for the MD_KeywordTypeCode.
 * @param {Object} options - Configuration options.
 * @param {Array} [options.fieldKeys] - Array of keys representing the structure of the keyword object.
 * @param {Array} [options.matchKeys] - Array of keys used to match existing keywords.
 * @param {Function} [options.getValue] - Optional custom function to format the string value before saving.
 * @param {Array<{path: string, getValue: Function}>} [options.additionalPaths] Secondary sync paths.
 * @param {string} [options.nodeXPath] - Optional custom XPath string to identify the keyword node, overrides default.
 */
const createKeywordBlock = (type, {
  fieldKeys, matchKeys, getValue, additionalPaths = [], nodeXPath
}) => blockScheme({
  nodeXPath: nodeXPath || `//gmd:descriptiveKeywords/gmd:MD_Keywords[
      gmd:type/gmd:MD_KeywordTypeCode/@codeListValue = '${type}' 
    ]`.replace(/\s+/g, ' '),

  find: {
    fieldPaths: ISO19115_FIELDS.keywordValue,
    valueKeys: fieldKeys,
    matchKeys,
    getNodeValueObject: ({ node, editor }) => {
      const anchorNode = editor.selectNodes(`./${ISO19115_FIELDS.keywordValue[0]}`, node)[0]
      const charStringNode = editor.selectNodes(`./${ISO19115_FIELDS.keywordValue[1]}`, node)[0]
      const fullString = (anchorNode || charStringNode)?.textContent || ''
      const parts = fullString.split(' > ').map((s) => s.trim())

      // Example: "EARTH SCIENCE > ATMOSPHERE > AEROSOLS" with fieldKeys
      // ["Category", "Topic", "Term"] becomes
      // { Category: "EARTH SCIENCE", Topic: "ATMOSPHERE", Term: "AEROSOLS" }.
      return fieldKeys.reduce((acc, key, index) => {
        acc[key] = parts[index] || ''

        return acc
      }, {})
    }
  },
  replace: [
    {
      fieldPath: ({ node, editor }) => (
        editor.selectNodes(`./${ISO19115_FIELDS.keywordValue[0]}`, node).length > 0
          ? ISO19115_FIELDS.keywordValue[0]
          : ISO19115_FIELDS.keywordValue[1]
      ),
      source: {
        type: 'computed',
        getValue: getValue || (({ correction }) => buildKeywordPath(
          fieldKeys,
          correction.newKeywordObject
        ))
      }
    },
    ...additionalPaths.map(({ path, getValue: pathGetValue }) => ({
      fieldPath: path,
      source: {
        type: 'computed',
        getValue: pathGetValue
      }
    }))
  ]
})

/**
 * Creates an editor for ISO Topic Category nodes.
 * Updates both the text content and the @codeListValue attribute.
 */
const createIsoTopicCategoryEditor = () => leafScheme({
  nodeXPath: '//gmd:identificationInfo/gmd:MD_DataIdentification/gmd:topicCategory',
  find: {
    getNodeValueObject: ({ node }) => ({
      [CSV_FIELDS.isoTopicCategory]: node.textContent?.trim() || ''
    })
  },
  replace: [
    {
      // 1. Update the visible text content
      fieldPath: ISO19115_FIELDS.isoTopicCategory,
      source: {
        type: 'computed',
        getValue: ({ correction }) => (
          correction.newKeywordObject[CSV_FIELDS.isoTopicCategory]
        )
      }
    },
    {
      // 2. Update the codeListValue attribute
      fieldPath: ISO19115_FIELDS.isoTopicCategoryCodeListValue,
      source: {
        type: 'computed',
        getValue: ({ correction }) => (
          correction.newKeywordObject[CSV_FIELDS.isoTopicCategory]
        )
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
      [CSV_FIELDS.productLevelId]: editor
        .getNestedText(node, ISO19115_FIELDS.productLevelId)?.trim() || ''
    })
  },
  delete: [
    // Remove the entire processingLevel parent wrapper (in identificationInfo)
    {
      path: '//gmd:identificationInfo//gmd:processingLevel[gmd:MD_Identifier/gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]',
      matchValuePath: 'gmd:MD_Identifier/gmd:code/gco:CharacterString'
    },
    // Remove the entire processingLevelCode parent wrapper (in contentInfo)
    {
      path: '//gmd:contentInfo//gmd:processingLevelCode[gmd:MD_Identifier/gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]',
      matchValuePath: 'gmd:MD_Identifier/gmd:code/gco:CharacterString'
    }
  ],
  replace: [
    {
      fieldPath: ISO19115_FIELDS.productLevelId,
      source: {
        type: 'computed',
        getValue: ({ correction }) => correction.newKeywordObject[CSV_FIELDS.productLevelId]
      }
    },
    {
      // Target specific secondary locations for synchronization
      fieldPath: '//gmd:contentInfo/gmd:MD_ImageDescription/gmd:processingLevelCode/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.processinglevelid"]/gmd:code/gco:CharacterString',
      source: {
        type: 'computed',
        getValue: ({ correction }) => correction.newKeywordObject[CSV_FIELDS.productLevelId]
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
      fieldKeys: CSV_FIELDS.sciencekeywords,
      matchKeys: CSV_FIELDS.sciencekeywords
    }
  ),

  locations: createKeywordBlock(
    'place',
    {
      fieldKeys: CSV_FIELDS.locations,
      matchKeys: CSV_FIELDS.locations
    }
  ),

  platforms: createKeywordBlock('platform', {
    fieldKeys: [CSV_FIELDS.shortName, ISO19115_FIELDS.keywordLongName],
    matchKeys: [CSV_FIELDS.shortName],
    getValue: ({ correction }) => {
      const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
      const LongName = correction.newLongName || ''

      return LongName ? `${shortName} > ${LongName}` : shortName
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
            const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
            const LongName = correction.newLongName || ''

            return LongName ? `${shortName} > ${LongName}` : shortName
          }

          // Otherwise use ShortName only (NSIDC/NOAA format)
          return correction.newKeywordObject[CSV_FIELDS.shortName]
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:platform/gmi:MI_Platform/gmi:identifier/gmd:MD_Identifier/gmd:code/gco:CharacterString',
        getValue: ({ correction, node }) => {
          const existingValue = node?.textContent || ''
          if (existingValue.includes(' > ')) {
            const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
            const LongName = correction.newLongName || ''

            return LongName ? `${shortName} > ${LongName}` : shortName
          }

          return correction.newKeywordObject[CSV_FIELDS.shortName]
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
    fieldKeys: [CSV_FIELDS.shortName, ISO19115_FIELDS.keywordLongName],
    matchKeys: [CSV_FIELDS.shortName],
    getValue: ({ correction }) => {
      const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
      const LongName = correction.newLongName || ''

      return LongName ? `${shortName} > ${LongName}` : shortName
    },
    // Sync with acquisition information section
    // Smart detection: if gmd:code contains ' > ', use combined format (CWIC style)
    // Otherwise use split format (NSIDC/NOAA style)
    additionalPaths: [
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation//gmi:instrument/eos:EOS_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:code/gco:CharacterString',
        getValue: ({ correction, node }) => {
          const existingValue = node?.textContent || ''
          if (existingValue.includes(' > ')) {
            const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
            const LongName = correction.newLongName || ''

            return LongName ? `${shortName} > ${LongName}` : shortName
          }

          return correction.newKeywordObject[CSV_FIELDS.shortName]
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation//gmi:instrument/gmi:MI_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:code/gco:CharacterString',
        getValue: ({ correction, node }) => {
          const existingValue = node?.textContent || ''
          if (existingValue.includes(' > ')) {
            const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
            const LongName = correction.newLongName || ''

            return LongName ? `${shortName} > ${LongName}` : shortName
          }

          return correction.newKeywordObject[CSV_FIELDS.shortName]
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation//gmi:instrument/eos:EOS_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:description/gco:CharacterString',
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
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation//gmi:instrument/gmi:MI_Instrument/gmi:identifier/gmd:MD_Identifier/gmd:description/gco:CharacterString',
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
    fieldKeys: [CSV_FIELDS.shortName, ISO19115_FIELDS.keywordLongName],
    matchKeys: [CSV_FIELDS.shortName],
    getValue: ({ correction }) => {
      const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
      const LongName = correction.newLongName || ''

      return LongName ? `${shortName} > ${LongName}` : shortName
    },
    // Sync with acquisition information section (gmi:MI_Operation)
    additionalPaths: [
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:operation/gmi:MI_Operation/gmi:identifier/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.projectshortname"]/gmd:code/gco:CharacterString',
        getValue: ({ correction }) => {
          const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
          const LongName = correction.newLongName || ''

          return LongName ? `${shortName} > ${LongName}` : shortName
        }
      },
      {
        path: '//gmi:acquisitionInformation/gmi:MI_AcquisitionInformation/gmi:operation/gmi:MI_Operation/gmi:identifier/gmd:MD_Identifier[gmd:codeSpace/gco:CharacterString="gov.nasa.esdis.umm.projectshortname"]/gmd:description/gco:CharacterString',
        getValue: ({ correction }) => correction.newLongName || ''
      }
    ]
  }),

  providers: createKeywordBlock('dataCentre', {
    fieldKeys: [CSV_FIELDS.shortName, ISO19115_FIELDS.keywordLongName],
    matchKeys: [CSV_FIELDS.shortName],
    getValue: ({ correction }) => {
      const shortName = correction.newKeywordObject[CSV_FIELDS.shortName]
      const LongName = correction.newLongName || ''

      return LongName ? `${shortName} > ${LongName}` : shortName
    }
  }),

  dataformat: leafScheme({
    // Target the wrapper block so deletion removes the entire format entry cleanly
    nodeXPath: '//gmd:distributionInfo/gmd:MD_Distribution/gmd:distributionFormat',
    find: {
      getNodeValueObject: ({ node, editor }) => {
        const charStringNode = editor.selectNodes('.//gmd:name/gco:CharacterString', node)[0]

        return {
          [CSV_FIELDS.shortName]: charStringNode?.textContent?.trim() || ''
        }
      }
    },
    replace: [
      {
        fieldPath: ISO19115_FIELDS.dataformat,
        source: {
          type: 'computed',
          getValue: ({ correction }) => correction.newKeywordObject[CSV_FIELDS.shortName]
        }
      }
    ]
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
