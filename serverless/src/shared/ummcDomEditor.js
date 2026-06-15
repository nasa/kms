import JsonMetadataPathEditor, { sequentialValueReplace } from './JsonMetadataPathEditor'
import { FULL_PATH_VALUE_FIELDS } from './redis-path-store/helpers/constants'

/**
 * A unified scheme creator that selects the appropriate
 * editor method based on the configuration keys.
 */
const unifiedBlockScheme = (config) => (editor, correction) => {
  // If a containerPath exists, it's a nested node
  if (config.containerPath) {
    return editor.updateNestedBlockNode(correction, config)
  }

  // Otherwise, treat it as a standard block node
  return editor.updateBlockNode(correction, config)
}

// Wrap a leaf-value scheme config in the shared editor contract used by the UMM-C delegate.
const leafScheme = (config) => (editor, correction) => editor.updateLeafNode(correction, config)
// Wrap a scalar/root-field scheme config in the shared editor contract used by the UMM-C delegate.
const scalarScheme = (config) => (editor, correction) => editor.updateScalarNode(correction, config)

/**
 * Unified utility for array cleanup.
 */
const cleanupArray = (doc, key, childKey = null) => {
  if (!doc[key]) return

  // Logic for nested cleanup
  if (childKey) {
    const filtered = doc[key].filter(
      (item) => item[childKey] && item[childKey].length > 0
    )

    if (filtered.length === 0) {
      // eslint-disable-next-line no-param-reassign
      delete doc[key]
    } else {
      // eslint-disable-next-line no-param-reassign
      doc[key] = filtered
    }

    return
  }

  // Logic for standard empty array cleanup
  if (Array.isArray(doc[key]) && doc[key].length === 0) {
    // eslint-disable-next-line no-param-reassign
    delete doc[key]
  }
}

/**
 * UMM-C scheme configuration for the shared JSON path editor.
 *
 * The object keys here are the incoming KMS scheme names from `correction.scheme`
 * (for example `sciencekeywords`, `platforms`, or `providers`). The UMM-C delegate
 * lowercases `correction.scheme` and uses it to look up the matching function in
 * this map, so these keys are dispatch identifiers, not UMM-C JSON property names.
 *
 * Each scheme describes:
 * - the JSONPath used to find candidate UMM-C nodes
 * - how to match the current normalized keyword object from JSON content
 * - how replacement values map back into UMM-C fields
 *
 * @type {Object.<string, Function>}
 */
export const UMMC_SCHEME_EDITORS = {
  sciencekeywords: unifiedBlockScheme({
    nodePath: '//Collection/ScienceKeywords',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'ScienceKeywords')
    },
    find: {
      fieldPaths: FULL_PATH_VALUE_FIELDS.sciencekeywords,
      valueKeys: FULL_PATH_VALUE_FIELDS.sciencekeywords
    },
    replace: sequentialValueReplace(FULL_PATH_VALUE_FIELDS.sciencekeywords)
  }),
  locations: unifiedBlockScheme({
    nodePath: '//Collection/LocationKeywords',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'LocationKeywords')
    },
    find: {
      fieldPaths: FULL_PATH_VALUE_FIELDS.locations,
      valueKeys: FULL_PATH_VALUE_FIELDS.locations
    },
    replace: sequentialValueReplace(FULL_PATH_VALUE_FIELDS.locations)
  }),
  chronounits: unifiedBlockScheme({
    // 1. Path to the parent container
    containerPath: '//Collection/PaleoTemporalCoverages',
    // 2. The key containing the target array
    childKey: 'ChronostratigraphicUnits',
    // 3. Match using all relevant hierarchy fields
    find: {
      fieldPaths: ['Eon', 'Era', 'Period', 'Epoch', 'Stage', 'DetailedClassification'],
      valueKeys: FULL_PATH_VALUE_FIELDS.chronounits
    },
    // 4. Map the replacement values
    replace: sequentialValueReplace(
      ['Eon', 'Era', 'Period', 'Epoch', 'Stage', 'DetailedClassification'],
      FULL_PATH_VALUE_FIELDS.chronounits
    ),
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'PaleoTemporalCoverages', 'ChronostratigraphicUnits')
    }
  }),
  platforms: unifiedBlockScheme({
    nodePath: '//Collection/Platforms',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'Platforms')
    },
    find: {
      fieldPaths: [
        // JSON fields to read from
        'ShortName'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: 'Type',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'Type'
        }
      },
      {
        // JSON field to write to
        fieldPath: 'ShortName',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // JSON field to write to
        fieldPath: 'LongName',
        source: {
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  instruments: unifiedBlockScheme({
    containerPath: '//Collection/Platforms',
    childKey: 'Instruments',
    find: {
      fieldPaths: ['ShortName'],
      valueKeys: ['ShortName']
    },
    replace: [
      {
        fieldPath: 'ShortName',
        source: {
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        fieldPath: 'LongName',
        source: {
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  projects: unifiedBlockScheme({
    nodePath: '//Collection/Projects',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'Projects')
    },
    find: {
      fieldPaths: [
        // JSON fields to read from
        'ShortName'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: 'ShortName',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // JSON field to write to
        fieldPath: 'LongName',
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  providers: unifiedBlockScheme({
    nodePath: '//Collection/DataCenters',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'DataCenters')
    },
    find: {
      fieldPaths: [
        // JSON fields to read from
        'ShortName'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: 'ShortName',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // JSON field to write to
        fieldPath: 'LongName',
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  rucontenttype: unifiedBlockScheme({
    nodePath: '//Collection/RelatedUrls',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'RelatedUrls')
    },
    find: {
      fieldPaths: FULL_PATH_VALUE_FIELDS.rucontenttype,
      valueKeys: FULL_PATH_VALUE_FIELDS.rucontenttype
    },
    replace: sequentialValueReplace(FULL_PATH_VALUE_FIELDS.rucontenttype)
  }),
  idnnode: unifiedBlockScheme({
    nodePath: '//Collection/DirectoryNames',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'DirectoryNames')
    },
    find: {
      fieldPaths: [
        // JSON fields to read from
        'ShortName'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: 'ShortName',
        source: {
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // JSON field to write to
        fieldPath: 'LongName',
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  isotopiccategory: leafScheme({
    nodePath: '//Collection/ISOTopicCategories',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'ISOTopicCategories')
    }
  }),
  productlevelid: scalarScheme({
    nodePath: '//Collection/ProcessingLevel/Id',
    fieldName: 'Id',
    afterDelete: (editor) => {
      // When ProcessingLevel.Id is deleted, remove the entire ProcessingLevel object
      // This matches the expected behavior where the Id is the primary field
      if (editor.document.ProcessingLevel) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.ProcessingLevel
      }
    }
  })
}

/**
 * Creates a JSON-backed editor for a raw UMM-C JSON payload.
 *
 * @param {string} metadataPayload Raw UMM-C JSON string.
 * @returns {JsonMetadataPathEditor} Shared JSON path editor instance.
 */
export const createUmmcEditor = (metadataPayload) => new JsonMetadataPathEditor(metadataPayload)

export default UMMC_SCHEME_EDITORS
