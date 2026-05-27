import XmlMetadataPathEditor, { sequentialReplace } from './XmlMetadataPathEditor'

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
 * - how to match the current keyword path from XML content
 * - how replacement values map back into DIF10 fields
 *
 * @type {Object.<string, Function>}
 */
export const DIF10_SCHEME_EDITORS = {
  sciencekeywords: blockScheme({
    nodeXPath: '//DIF/Science_Keywords',
    find: {
      fieldPaths: [
        'Category',
        'Topic',
        'Term',
        'Variable_Level_1',
        'Variable_Level_2',
        'Variable_Level_3',
        'Detailed_Variable'
      ]
    },
    // Example correction input:
    // {
    //   scheme: 'sciencekeywords',
    //   action: 'replace',
    //   oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
    //   newKeywordPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS'
    // }
    //
    // sequentialReplace(...) maps the ordered KMS path segments back into the
    // ordered DIF10 XML fields:
    // - Category <- 'EARTH SCIENCE'
    // - Topic <- 'OCEANS'
    // - Term <- 'MARINE SEDIMENTS'
    replace: sequentialReplace([
      'Category',
      'Topic',
      'Term',
      'Variable_Level_1',
      'Variable_Level_2',
      'Variable_Level_3',
      'Detailed_Variable'
    ])
  }),
  locations: blockScheme({
    nodeXPath: '//DIF/Location',
    find: {
      fieldPaths: [
        'Location_Category',
        'Location_Type',
        'Location_Subregion1',
        'Location_Subregion2',
        'Location_Subregion3',
        'Detailed_Location'
      ]
    },
    replace: sequentialReplace([
      'Location_Category',
      'Location_Type',
      'Location_Subregion1',
      'Location_Subregion2',
      'Location_Subregion3',
      'Detailed_Location'
    ])
  }),
  chronounits: blockScheme({
    nodeXPath: '//DIF/Temporal_Coverage/Paleo_DateTime/Chronostratigraphic_Unit',
    find: {
      fieldPaths: [
        'Eon',
        'Era',
        'Period',
        'Epoch',
        'Stage',
        'Detailed_Classification'
      ]
    },
    replace: sequentialReplace([
      'Eon',
      'Era',
      'Period',
      'Epoch',
      'Stage',
      'Detailed_Classification'
    ])
  }),
  platforms: blockScheme({
    // KMS platform paths use four slots:
    // 0 = taxonomy context (for example "Space-based Platforms")
    // 1 = DIF10 <Type>
    // 2 = reserved blank placeholder
    // 3 = DIF10 <Short_Name>
    //
    // DIF10 Platform does not persist slots 0 or 2, so only slots 1 and 3
    // are written back into the XML.
    nodeXPath: '//DIF/Platform',
    find: {
      fieldPaths: ['Short_Name'],
      takeLastSegments: 1
    },
    replace: [
      {
        fieldPath: 'Type',
        source: {
          type: 'path',
          pathIndex: 1
        }
      },
      {
        fieldPath: 'Short_Name',
        source: {
          type: 'path',
          pathIndex: 3
        }
      },
      {
        fieldPath: 'Long_Name',
        source: {
          // Example correction input:
          // {
          //   scheme: 'platforms',
          //   action: 'replace',
          //   oldKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4',
          //   newKeywordPath: 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4-UPDATED',
          //   newLongName: 'Systeme Observation de la Terre-4 Updated'
          // }
          //
          // This reads the replacement value directly from correction.newLongName
          // instead of taking it from a path position in newKeywordPath.
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  instruments: blockScheme({
    nodeXPath: '//DIF/Platform/Instrument',
    find: {
      fieldPaths: ['Short_Name'],
      takeLastSegments: 1
    },
    replace: [
      {
        fieldPath: 'Short_Name',
        source: {
          type: 'path',
          pathIndex: 'last'
        }
      },
      {
        fieldPath: 'Long_Name',
        source: {
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  projects: blockScheme({
    nodeXPath: '//DIF/Project',
    find: {
      fieldPaths: ['Short_Name'],
      takeLastSegments: 1
    },
    replace: [
      {
        fieldPath: 'Short_Name',
        source: {
          type: 'path',
          pathIndex: 'last'
        }
      },
      {
        fieldPath: 'Long_Name',
        source: {
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  providers: blockScheme({
    nodeXPath: '//DIF/Organization',
    find: {
      fieldPaths: ['Organization_Name/Short_Name'],
      takeLastSegments: 1
    },
    replace: [
      {
        fieldPath: 'Organization_Name/Short_Name',
        source: {
          type: 'path',
          pathIndex: 'last'
        }
      },
      {
        fieldPath: 'Organization_Name/Long_Name',
        source: {
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  rucontenttype: blockScheme({
    nodeXPath: '//DIF/Related_URL/URL_Content_Type',
    find: {
      fieldPaths: ['Type', 'Subtype'],
      takeLastSegments: 2
    },
    replace: [
      {
        fieldPath: 'Type',
        source: {
          // Example correction input:
          // {
          //   scheme: 'rucontenttype',
          //   action: 'replace',
          //   oldKeywordPath: 'DistributionURL > VIEW RELATED INFORMATION > OpenSearch',
          //   newKeywordPath: 'DistributionURL > VIEW RELATED INFORMATION > OGC WMS'
          // }
          //
          // takeLastSegments: 2 narrows the newKeywordPath to:
          // ['VIEW RELATED INFORMATION', 'OGC WMS']
          // so pathIndex: 0 writes the DIF10 <Type> value.
          type: 'path',
          pathIndex: 0,
          takeLastSegments: 2
        }
      },
      {
        fieldPath: 'Subtype',
        source: {
          type: 'path',
          pathIndex: 1,
          takeLastSegments: 2
        }
      }
    ],
    removeNodeIfEmptyAfterReplace: true
  }),
  idnnode: blockScheme({
    nodeXPath: '//DIF/IDN_Node',
    find: {
      fieldPaths: ['Short_Name'],
      takeLastSegments: 1
    },
    replace: [
      {
        fieldPath: 'Short_Name',
        source: {
          // Example correction input:
          // {
          //   scheme: 'idnnode',
          //   action: 'replace',
          //   oldKeywordPath: 'CEOS',
          //   newKeywordPath: 'AMD/NZ',
          //   newLongName: 'Antarctic Master Directory/New Zealand'
          // }
          //
          // IDN nodes are modeled as a single free-form value, so the full
          // correction.newKeywordPath becomes the new <Short_Name>.
          type: 'param',
          key: 'newKeywordPath'
        }
      },
      {
        fieldPath: 'Long_Name',
        source: {
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  isotopiccategory: leafScheme({
    nodeXPath: '//DIF/ISO_Topic_Category'
  }),
  temporalresolutionrange: leafScheme({
    nodeXPath: '//DIF/Data_Resolution/Temporal_Resolution_Range',
    removeEmptyParent: true
  }),
  verticalresolutionrange: leafScheme({
    nodeXPath: '//DIF/Data_Resolution/Vertical_Resolution_Range',
    removeEmptyParent: true
  }),
  horizontalresolutionrange: leafScheme({
    nodeXPath: '//DIF/Data_Resolution/Horizontal_Resolution_Range'
  }),
  productlevelid: scalarScheme({
    // Example correction input:
    // {
    //   scheme: 'productlevelid',
    //   action: 'replace',
    //   oldKeywordPath: 'NA',
    //   newKeywordPath: '1A'
    // }
    //
    // Scalar schemes ignore path matching and update the one target field
    // selected by nodeXPath.
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
