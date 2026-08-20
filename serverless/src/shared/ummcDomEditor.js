import JsonMetadataPathEditor, { sequentialValueReplace } from './JsonMetadataPathEditor'
import { CSV_FIELDS, UMMC_FIELDS } from './redis-path-store/helpers/constants'

/**
 * A unified scheme creator that selects the appropriate
 * editor method based on the configuration keys.
 */
const unifiedBlockScheme = (config) => (editor, correction) => {
  // Support an array of configs
  if (Array.isArray(config)) {
    // Map each config to its update result (true if updated, false otherwise)
    const results = config.map((c) => {
      if (c.containerPath) return editor.updateNestedBlockNode(correction, c)

      return editor.updateBlockNode(correction, c)
    })

    // Return true if at least one operation in the array returned true
    return results.some((result) => result === true)
  }

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
    nodePath: '//ScienceKeywords',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'ScienceKeywords')
    },
    find: {
      fieldPaths: UMMC_FIELDS.sciencekeywords,
      valueKeys: CSV_FIELDS.sciencekeywords
    },
    replace: sequentialValueReplace(
      UMMC_FIELDS.sciencekeywords,
      CSV_FIELDS.sciencekeywords
    )
  }),
  locations: unifiedBlockScheme({
    nodePath: '//LocationKeywords',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'LocationKeywords')
    },
    find: {
      fieldPaths: UMMC_FIELDS.locations,
      valueKeys: CSV_FIELDS.locations
    },
    replace: sequentialValueReplace(
      UMMC_FIELDS.locations,
      CSV_FIELDS.locations
    )
  }),
  chronounits: unifiedBlockScheme({
    // 1. Path to the parent container
    containerPath: '//PaleoTemporalCoverages',
    // 2. The key containing the target array
    childKey: 'ChronostratigraphicUnits',
    // 3. Match using all relevant hierarchy fields
    find: {
      fieldPaths: UMMC_FIELDS.chronounits,
      valueKeys: CSV_FIELDS.chronounits
    },
    // 4. Map the replacement values
    replace: sequentialValueReplace(
      UMMC_FIELDS.chronounits,
      CSV_FIELDS.chronounits
    ),
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'PaleoTemporalCoverages', 'ChronostratigraphicUnits')
    }
  }),
  platforms: unifiedBlockScheme({
    nodePath: '//Platforms',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'Platforms')
    },
    find: {
      fieldPaths: [UMMC_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.platformType,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.category
        }
      },
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.longName,
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
      fieldPaths: [UMMC_FIELDS.shortName],
      valueKeys: [CSV_FIELDS.shortName]
    },
    replace: [
      {
        fieldPath: UMMC_FIELDS.shortName,
        source: {
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        fieldPath: UMMC_FIELDS.longName,
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
      cleanupArray(editor.document, 'Projects')
    },
    find: {
      fieldPaths: [UMMC_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.longName,
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
      cleanupArray(editor.document, 'DataCenters')
    },
    find: {
      fieldPaths: [UMMC_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.longName,
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
      cleanupArray(editor.document, 'RelatedUrls')
    },
    find: {
      fieldPaths: UMMC_FIELDS.rucontenttype,
      valueKeys: CSV_FIELDS.rucontenttype
    },
    replace: sequentialValueReplace(
      UMMC_FIELDS.rucontenttype,
      CSV_FIELDS.rucontenttype
    )
  }),
  idnnode: unifiedBlockScheme({
    nodePath: '//DirectoryNames',
    afterDelete: (editor) => {
      cleanupArray(editor.document, 'DirectoryNames')
    },
    find: {
      fieldPaths: [UMMC_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.shortName,
        source: {
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // JSON field to write to
        fieldPath: UMMC_FIELDS.longName,
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
      cleanupArray(editor.document, 'ISOTopicCategories')
    }
  }),
  productlevelid: scalarScheme({
    nodePath: '//ProcessingLevel/Id',
    fieldName: UMMC_FIELDS.processingLevelId,
    afterDelete: (editor) => {
      // When ProcessingLevel.Id is deleted, remove the entire ProcessingLevel object
      // This matches the expected behavior where the Id is the primary field
      if (editor.document.ProcessingLevel) {
        // eslint-disable-next-line no-param-reassign
        delete editor.document.ProcessingLevel
      }
    }
  }),
  dataformat: unifiedBlockScheme([
    {
      containerPath: '//ArchiveAndDistributionInformation',
      childKey: 'FileArchiveInformation',
      find: {
        fieldPaths: [UMMC_FIELDS.dataformat],
        valueKeys: [CSV_FIELDS.shortName]
      },
      replace: [{
        fieldPath: UMMC_FIELDS.dataformat,
        source: {
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      }]
    },
    {
      containerPath: '//ArchiveAndDistributionInformation',
      childKey: 'FileDistributionInformation',
      find: {
        fieldPaths: [UMMC_FIELDS.dataformat],
        valueKeys: [CSV_FIELDS.shortName]
      },
      replace: [{
        fieldPath: UMMC_FIELDS.dataformat,
        source: {
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      }]
    }
  ])
}

/**
 * Creates a JSON-backed editor for a raw UMM-C JSON payload.
 *
 * @param {string} metadataPayload Raw UMM-C JSON string.
 * @returns {JsonMetadataPathEditor} Shared JSON path editor instance.
 */
export const createUmmcEditor = (metadataPayload) => new JsonMetadataPathEditor(metadataPayload)

export default UMMC_SCHEME_EDITORS
