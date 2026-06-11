import JsonMetadataPathEditor, { sequentialValueReplace } from './JsonMetadataPathEditor'

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
 * Generic utility for array cleanup
 */
const cleanupEmptyArray = (doc, key) => {
  if (Array.isArray(doc[key]) && doc[key].length === 0) {
    // eslint-disable-next-line no-param-reassign
    delete doc[key]
  }
}

/**
 * Generic utility for nested array cleanup
 */
const cleanupNestedArray = (doc, parentKey, childKey) => {
  if (!doc[parentKey]) return

  const filtered = doc[parentKey].filter(
    (item) => item[childKey] && item[childKey].length > 0
  )

  if (filtered.length === 0) {
    // eslint-disable-next-line no-param-reassign
    delete doc[parentKey]
  } else {
    // eslint-disable-next-line no-param-reassign
    doc[parentKey] = filtered
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
    nodePath: '//ScienceKeywords',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'ScienceKeywords')
    },
    find: {
      fieldPaths: [
        // JSON fields to read from
        'Category',
        'Topic',
        'Term',
        'VariableLevel1',
        'VariableLevel2',
        'VariableLevel3',
        'DetailedVariable'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'Category',
        'Topic',
        'Term',
        'VariableLevel1',
        'VariableLevel2',
        'VariableLevel3',
        'DetailedVariable'
      ]
    },
    replace: sequentialValueReplace(
      [
        // JSON fields to write to
        'Category',
        'Topic',
        'Term',
        'VariableLevel1',
        'VariableLevel2',
        'VariableLevel3',
        'DetailedVariable'
      ],
      [
        // Keys from newKeywordObject to read from
        'Category',
        'Topic',
        'Term',
        'VariableLevel1',
        'VariableLevel2',
        'VariableLevel3',
        'DetailedVariable'
      ]
    )
  }),
  locations: unifiedBlockScheme({
    nodePath: '//LocationKeywords',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'LocationKeywords')
    },
    find: {
      fieldPaths: [
        // JSON fields to read from
        'Category',
        'Type',
        'Subregion1',
        'Subregion2',
        'Subregion3',
        'DetailedLocation'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'Category',
        'Type',
        'Subregion1',
        'Subregion2',
        'Subregion3',
        'DetailedLocation'
      ]
    },
    replace: sequentialValueReplace(
      [
        // JSON fields to write to
        'Category',
        'Type',
        'Subregion1',
        'Subregion2',
        'Subregion3',
        'DetailedLocation'
      ],
      [
        // Keys from newKeywordObject to read from
        'Category',
        'Type',
        'Subregion1',
        'Subregion2',
        'Subregion3',
        'DetailedLocation'
      ]
    )
  }),
  chronounits: unifiedBlockScheme({
    // 1. Path to the parent container
    containerPath: '//PaleoTemporalCoverages',
    // 2. The key containing the target array
    childKey: 'ChronostratigraphicUnits',
    // 3. Match using all relevant hierarchy fields
    find: {
      fieldPaths: ['Eon', 'Era', 'Period', 'Epoch', 'Stage', 'DetailedClassification'],
      valueKeys: ['Eon', 'Era', 'Period', 'Epoch', 'Age', 'SubAge']
    },
    // 4. Map the replacement values
    replace: [
      {
        fieldPath: 'Eon',
        source: {
          type: 'value',
          key: 'Eon'
        }
      },
      {
        fieldPath: 'Era',
        source: {
          type: 'value',
          key: 'Era'
        }
      },
      {
        fieldPath: 'Period',
        source: {
          type: 'value',
          key: 'Period'
        }
      },
      {
        fieldPath: 'Epoch',
        source: {
          type: 'value',
          key: 'Epoch'
        }
      },
      {
        fieldPath: 'Stage',
        source: {
          type: 'value',
          key: 'Age'
        }
      },
      {
        fieldPath: 'DetailedClassification',
        source: {
          type: 'value',
          key: 'SubAge'
        }
      }
    ],
    afterDelete: (editor) => {
      cleanupNestedArray(editor.document, 'PaleoTemporalCoverages', 'ChronostratigraphicUnits')
    }
  }),
  platforms: unifiedBlockScheme({
    nodePath: '//Platforms',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'Platforms')
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
    containerPath: '//Platforms',
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
    nodePath: '//Projects',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'Projects')
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
    nodePath: '//DataCenters',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'DataCenters')
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
    nodePath: '//RelatedUrls',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'RelatedUrls')
    },
    find: {
      fieldPaths: [
        // JSON fields to read from (in schema order: URLContentType, Type, Subtype)
        'URLContentType',
        'Type',
        'Subtype'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'URLContentType',
        'Type',
        'Subtype'
      ]
    },
    replace: sequentialValueReplace([
      // JSON fields to write to and keys from newKeywordObject to read from (in schema order)
      'URLContentType',
      'Type',
      'Subtype'
    ]),
    removeNodeIfEmptyAfterReplace: true
  }),
  idnnode: unifiedBlockScheme({
    nodePath: '//DirectoryNames',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'DirectoryNames')
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
    nodePath: '//ISOTopicCategories',
    afterDelete: (editor) => {
      cleanupEmptyArray(editor.document, 'ISOTopicCategories')
    }
  }),
  productlevelid: scalarScheme({
    nodePath: '//ProcessingLevel/Id',
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
