import JsonMetadataPathEditor, { sequentialValueReplace } from './JsonMetadataPathEditor'

// Wrap a block-style scheme config in the shared editor contract used by the UMM-C delegate.
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)
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
  sciencekeywords: blockScheme({
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
  locations: blockScheme({
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
  chronounits: (editor, correction) => {
    const action = String(correction.action || 'replace').toLowerCase()
    const paleoTemporalCoverages = editor.selectNodes('//PaleoTemporalCoverages')

    if (!Array.isArray(paleoTemporalCoverages) || paleoTemporalCoverages.length === 0) {
      return false
    }

    const fields = ['Eon', 'Era', 'Period', 'Epoch', 'Stage', 'DetailedClassification']
    const oldKeyword = correction?.oldKeywordObject

    if (!oldKeyword) {
      return false
    }

    // Search through all PaleoTemporalCoverages for matching chronounit
    const result = paleoTemporalCoverages.some((coverage) => {
      if (!Array.isArray(coverage?.ChronostratigraphicUnits)) {
        return false
      }

      const unitIndex = coverage.ChronostratigraphicUnits
        .findIndex((unit) => fields.every((field) => {
          const oldVal = String(oldKeyword[field] || '').trim()
          const unitVal = String(unit?.[field] || '').trim()

          return oldVal === unitVal
        }))

      if (unitIndex === -1) {
        return false
      }

      if (action === 'delete') {
        // eslint-disable-next-line no-param-reassign
        coverage.ChronostratigraphicUnits.splice(unitIndex, 1)
        if (coverage.ChronostratigraphicUnits.length === 0) {
          // Remove the entire PaleoTemporalCoverages entry if it's now empty
          const { document } = editor
          const coverageIndex = paleoTemporalCoverages.indexOf(coverage)
          const allCoverages = document.PaleoTemporalCoverages
          if (Array.isArray(allCoverages)) {
            allCoverages.splice(coverageIndex, 1)
            if (allCoverages.length === 0) {
              delete document.PaleoTemporalCoverages
            }
          }
        }

        return true
      }

      if (action === 'replace') {
        const unit = coverage.ChronostratigraphicUnits[unitIndex]
        const newKeyword = correction?.newKeywordObject

        fields.forEach((field) => {
          const newVal = newKeyword?.[field]
          if (newVal) {
            // eslint-disable-next-line no-param-reassign
            unit[field] = newVal
          } else if (newVal === '') {
            // eslint-disable-next-line no-param-reassign
            delete unit[field]
          }
        })

        return true
      }

      return false
    })

    return result
  },
  platforms: blockScheme({
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
  instruments: (editor, correction) => {
    const action = String(correction.action || 'replace').toLowerCase()
    const platforms = editor.selectNodes('//Platforms')

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return false
    }

    const oldShortName = correction?.oldKeywordObject?.ShortName
    if (!oldShortName) {
      return false
    }

    // Search through all platforms for the matching instrument
    const result = platforms.some((platform) => {
      if (!Array.isArray(platform?.Instruments)) {
        return false
      }

      const instrumentIndex = platform.Instruments.findIndex(
        (inst) => inst?.ShortName === oldShortName
      )

      if (instrumentIndex === -1) {
        return false
      }

      if (action === 'delete') {
        // eslint-disable-next-line no-param-reassign
        platform.Instruments.splice(instrumentIndex, 1)
        if (platform.Instruments.length === 0) {
          // eslint-disable-next-line no-param-reassign
          delete platform.Instruments
        }

        return true
      }

      if (action === 'replace') {
        const instrument = platform.Instruments[instrumentIndex]
        const newShortName = correction?.newKeywordObject?.ShortName
        const newLongName = correction?.newLongName

        if (newShortName) {
          // eslint-disable-next-line no-param-reassign
          instrument.ShortName = newShortName
        }

        if (newLongName) {
          // eslint-disable-next-line no-param-reassign
          instrument.LongName = newLongName
        } else if (newLongName === '') {
          // eslint-disable-next-line no-param-reassign
          delete instrument.LongName
        }

        return true
      }

      return false
    })

    return result
  },
  //   Replace: [
  //     { fieldPath: 'ShortName', source: { type: 'value', key: 'ShortName' } },
  //     { fieldPath: 'LongName', source: { type: 'param', key: 'newLongName' } }
  //   ]
  // }),
  projects: blockScheme({
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
  providers: blockScheme({
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
  rucontenttype: blockScheme({
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
  idnnode: blockScheme({
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
