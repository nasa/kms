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
      const keywords = editor.document.ScienceKeywords
      if (Array.isArray(keywords) && keywords.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.ScienceKeywords
      }
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
    // Example correction input:
    // {
    //   scheme: 'sciencekeywords',
    //   action: 'replace',
    //   oldKeywordObject: {
    //     Category: 'EARTH SCIENCE',
    //     Topic: 'ATMOSPHERE',
    //     Term: 'AEROSOLS'
    //   },
    //   newKeywordObject: {
    //     Category: 'EARTH SCIENCE',
    //     Topic: 'OCEANS',
    //     Term: 'MARINE SEDIMENTS'
    //   }
    // }
    //
    // sequentialValueReplace(...) maps the canonical keyword-object values back into the
    // ordered UMM-C JSON fields:
    // - Category <- 'EARTH SCIENCE'
    // - Topic <- 'OCEANS'
    // - Term <- 'MARINE SEDIMENTS'
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
      const keywords = editor.document.LocationKeywords
      if (Array.isArray(keywords) && keywords.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.LocationKeywords
      }
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
    // In ummcDomEditor.js
    afterDelete: (editorInstance) => {
      // 1. Create a local reference to the object you need to clean
      const doc = editorInstance.document

      if (doc.PaleoTemporalCoverages) {
        const pCoverages = doc.PaleoTemporalCoverages

        // 2. Perform the logic using the local reference
        const filtered = pCoverages.filter((pc) => pc.ChronostratigraphicUnits
         && pc.ChronostratigraphicUnits.length > 0)

        // 3. Mutate the property via the local reference (this is safe)
        if (filtered.length === 0) {
          delete doc.PaleoTemporalCoverages
        } else {
          doc.PaleoTemporalCoverages = filtered
        }
      }
    }
  }),
  platforms: unifiedBlockScheme({
    // Platform corrections are normalized into an object that can carry:
    // - Class: the GCMD platform class, for example "Space-based Platforms"
    // - Type: UMM-C Type
    // - ShortName: UMM-C ShortName
    //
    // UMM-C Platform only persists `Type` and `ShortName`, so those are the
    // only object fields written back into the JSON.
    nodePath: '//Platforms',
    afterDelete: (editor) => {
      const platforms = editor.document.Platforms
      if (Array.isArray(platforms) && platforms.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.Platforms
      }
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
          // Example correction input:
          // {
          //   scheme: 'platforms',
          //   action: 'replace',
          //   oldKeywordObject: {
          //     Class: 'Space-based Platforms',
          //     Type: 'Earth Observation Satellites',
          //     ShortName: 'SPOT-4'
          //   },
          //   newKeywordObject: {
          //     Class: 'Space-based Platforms',
          //     Type: 'Earth Observation Satellites',
          //     ShortName: 'SPOT-4-UPDATED'
          //   },
          //   newLongName: 'Systeme Observation de la Terre-4 Updated'
          // }
          //
          // This reads the replacement value directly from correction.newLongName
          // instead of taking it from the normalized keyword object.
          // Correction param to read from
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
      const projects = editor.document.Projects
      if (Array.isArray(projects) && projects.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.Projects
      }
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
      const dataCenters = editor.document.DataCenters
      if (Array.isArray(dataCenters) && dataCenters.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.DataCenters
      }
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
      const relatedUrls = editor.document.RelatedUrls
      if (Array.isArray(relatedUrls) && relatedUrls.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.RelatedUrls
      }
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
      const directoryNames = editor.document.DirectoryNames
      if (Array.isArray(directoryNames) && directoryNames.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.DirectoryNames
      }
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
          // Example correction input:
          // {
          //   scheme: 'idnnode',
          //   action: 'replace',
          //   oldKeywordObject: {
          //     ShortName: 'CEOS'
          //   },
          //   newKeywordObject: {
          //     ShortName: 'AMD/NZ'
          //   },
          //   newLongName: 'Antarctic Master Directory/New Zealand'
          // }
          //
          // IDN nodes are modeled as a single free-form keyword value, so the normalized
          // correction object carries the replacement in `newKeywordObject.ShortName`.
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
  isotopiccategory: leafScheme({
    nodePath: '//ISOTopicCategories',
    afterDelete: (editor) => {
      const categories = editor.document.ISOTopicCategories
      if (Array.isArray(categories) && categories.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.ISOTopicCategories
      }
    }
  }),
  productlevelid: scalarScheme({
    // Example correction input:
    // {
    //   scheme: 'productlevelid',
    //   action: 'replace',
    //   oldKeywordObject: {
    //     Value: 'NA'
    //   },
    //   newKeywordObject: {
    //     Value: '1A'
    //   }
    // }
    //
    // Scalar schemes ignore block/path matching and update the one target field
    // selected by nodePath. `fieldName` is only used when that field is missing
    // and the editor needs to create the scalar element under the UMM-C root.
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
