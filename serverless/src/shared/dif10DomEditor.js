import { CSV_FIELDS, DIF10_FIELDS } from './redis-path-store/helpers/constants'
import XmlMetadataPathEditor, { sequentialValueReplace } from './XmlMetadataPathEditor'

// Wrap a block-style scheme config in the shared editor contract used by the DIF10 delegate.
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)
// Wrap a leaf-value scheme config in the shared editor contract used by the DIF10 delegate.
const leafScheme = (config) => (editor, correction) => editor.updateLeafNode(correction, config)
// Wrap a scalar/root-field scheme config in the shared editor contract used by the DIF10 delegate.
const scalarScheme = (config) => (editor, correction) => editor.updateScalarNode(correction, config)

/**
 * DIF10 scheme configuration for the shared XML path editor.
 *
 * The object keys here are the incoming KMS scheme names from `correction.scheme`
 * (for example `sciencekeywords`, `platforms`, or `providers`). The DIF10 delegate
 * lowercases `correction.scheme` and uses it to look up the matching function in
 * this map, so these keys are dispatch identifiers, not DIF10 XML tag names.
 *
 * Each scheme describes:
 * - the XPath used to find candidate DIF10 nodes
 * - how to match the current normalized keyword object from XML content
 * - how replacement values map back into DIF10 fields
 *
 * @type {Object.<string, Function>}
 */
export const DIF10_SCHEME_EDITORS = {
  sciencekeywords: blockScheme({
    nodeXPath: '//DIF/Science_Keywords',
    find: {
      fieldPaths: DIF10_FIELDS.sciencekeywords,
      valueKeys: CSV_FIELDS.sciencekeywords
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
    // ordered DIF10 XML fields:
    // - Category <- 'EARTH SCIENCE'
    // - Topic <- 'OCEANS'
    // - Term <- 'MARINE SEDIMENTS'
    replace: sequentialValueReplace(
      DIF10_FIELDS.sciencekeywords,
      CSV_FIELDS.sciencekeywords
    )
  }),
  locations: blockScheme({
    nodeXPath: '//DIF/Location',
    find: {
      fieldPaths: DIF10_FIELDS.locations,
      valueKeys: CSV_FIELDS.locations
    },
    replace: sequentialValueReplace(
      DIF10_FIELDS.locations,
      CSV_FIELDS.locations
    )
  }),
  chronounits: blockScheme({
    nodeXPath: '//DIF/Temporal_Coverage/Paleo_DateTime/Chronostratigraphic_Unit',
    find: {
      fieldPaths: DIF10_FIELDS.chronounits,
      valueKeys: CSV_FIELDS.chronounits
    },
    replace: sequentialValueReplace(
      DIF10_FIELDS.chronounits,
      CSV_FIELDS.chronounits
    )
  }),
  platforms: blockScheme({
    // The platform CSV Category maps to the native DIF10 <Type> field.
    nodeXPath: '//DIF/Platform',
    find: {
      fieldPaths: [DIF10_FIELDS.shortName],
      valueKeys: [CSV_FIELDS.shortName]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.platformType,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.category
        }
      },
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.longName,
        source: {
          // Example correction input:
          // {
          //   scheme: 'platforms',
          //   action: 'replace',
          //   oldKeywordObject: {
          //     Basis: 'Space-based Platforms',
          //     Category: 'Earth Observation Satellites',
          //     SubCategory: '',
          //     ShortName: 'SPOT-4'
          //   },
          //   newKeywordObject: {
          //     Basis: 'Space-based Platforms',
          //     Category: 'Earth Observation Satellites',
          //     SubCategory: '',
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
  instruments: blockScheme({
    nodeXPath: '//DIF/Platform/Instrument',
    find: {
      fieldPaths: [DIF10_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.longName,
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  projects: blockScheme({
    nodeXPath: '//DIF/Project',
    find: {
      fieldPaths: [DIF10_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.longName,
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  providers: blockScheme({
    nodeXPath: '//DIF/Organization',
    find: {
      fieldPaths: [DIF10_FIELDS.providerShortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.providerShortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.providerLongName,
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  rucontenttype: blockScheme({
    nodeXPath: '//DIF/Related_URL/URL_Content_Type',
    find: {
      fieldPaths: DIF10_FIELDS.rucontenttype,
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.type,
        CSV_FIELDS.subtype
      ]
    },
    replace: sequentialValueReplace(
      DIF10_FIELDS.rucontenttype,
      CSV_FIELDS.rucontenttype.slice(1)
    ),
    removeNodeIfEmptyAfterReplace: true
  }),
  idnnode: blockScheme({
    nodeXPath: '//DIF/IDN_Node',
    find: {
      fieldPaths: [DIF10_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.shortName,
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
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: DIF10_FIELDS.longName,
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  isotopiccategory: leafScheme({
    nodeXPath: '//DIF/ISO_Topic_Category'
  }),
  verticalresolutionrange: leafScheme({
    nodeXPath: '//DIF/Data_Resolution/Vertical_Resolution_Range',
    removeEmptyParent: true
  }),
  horizontalresolutionrange: leafScheme({
    nodeXPath: '//DIF/Data_Resolution/Horizontal_Resolution_Range',
    removeEmptyParent: true
  }),
  productlevelid: scalarScheme({
    // Example correction input:
    // {
    //   scheme: 'productlevelid',
    //   action: 'replace',
    //   oldKeywordObject: {
    //     ProductLevelId: 'NA'
    //   },
    //   newKeywordObject: {
    //     ProductLevelId: '1A'
    //   }
    // }
    //
    // Scalar schemes ignore block/path matching and update the one target field
    // selected by nodeXPath. `tagName` is only used when that field is missing
    // and the editor needs to create the scalar element under the DIF root.
    nodeXPath: '//DIF/Product_Level_Id',
    tagName: 'Product_Level_Id'
  })
}

/**
 * Creates a DOM-backed editor for a raw DIF10 XML payload.
 *
 * @param {string} metadataPayload Raw DIF10 XML string.
 * @returns {XmlMetadataPathEditor} Shared XML path editor instance.
 */
export const createDif10Editor = (metadataPayload) => new XmlMetadataPathEditor(metadataPayload)

export default DIF10_SCHEME_EDITORS
