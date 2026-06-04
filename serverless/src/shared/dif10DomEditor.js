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
      fieldPaths: [
        // XML fields to read from
        'Category',
        'Topic',
        'Term',
        'Variable_Level_1',
        'Variable_Level_2',
        'Variable_Level_3',
        'Detailed_Variable'
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
    // ordered DIF10 XML fields:
    // - Category <- 'EARTH SCIENCE'
    // - Topic <- 'OCEANS'
    // - Term <- 'MARINE SEDIMENTS'
    replace: sequentialValueReplace(
      [
        // XML fields to write to
        'Category',
        'Topic',
        'Term',
        'Variable_Level_1',
        'Variable_Level_2',
        'Variable_Level_3',
        'Detailed_Variable'
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
    nodeXPath: '//DIF/Location',
    find: {
      fieldPaths: [
        // XML fields to read from
        'Location_Category',
        'Location_Type',
        'Location_Subregion1',
        'Location_Subregion2',
        'Location_Subregion3',
        'Detailed_Location'
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
        // XML fields to write to
        'Location_Category',
        'Location_Type',
        'Location_Subregion1',
        'Location_Subregion2',
        'Location_Subregion3',
        'Detailed_Location'
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
  chronounits: blockScheme({
    nodeXPath: '//DIF/Temporal_Coverage/Paleo_DateTime/Chronostratigraphic_Unit',
    find: {
      fieldPaths: [
        // XML fields to read from
        'Eon',
        'Era',
        'Period',
        'Epoch',
        'Stage',
        'Detailed_Classification'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'Eon',
        'Era',
        'Period',
        'Epoch',
        'Age',
        'SubAge'
      ]
    },
    replace: sequentialValueReplace(
      [
        // XML fields to write to
        'Eon',
        'Era',
        'Period',
        'Epoch',
        'Stage',
        'Detailed_Classification'
      ],
      [
        // Keys from newKeywordObject to read from
        'Eon',
        'Era',
        'Period',
        'Epoch',
        'Age',
        'SubAge'
      ]
    )
  }),
  platforms: blockScheme({
    // Platform corrections are normalized into an object that can carry:
    // - Class: the GCMD platform class, for example "Space-based Platforms"
    // - Type: DIF10 <Type>
    // - ShortName: DIF10 <Short_Name>
    //
    // DIF10 Platform only persists `Type` and `ShortName`, so those are the
    // only object fields written back into the XML.
    nodeXPath: '//DIF/Platform',
    find: {
      fieldPaths: [
        // XML fields to read from
        'Short_Name'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'Type',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'Type'
        }
      },
      {
        // XML field to write to
        fieldPath: 'Short_Name',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
        fieldPath: 'Long_Name',
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
  instruments: blockScheme({
    nodeXPath: '//DIF/Platform/Instrument',
    find: {
      fieldPaths: [
        // XML fields to read from
        'Short_Name'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'Short_Name',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
        fieldPath: 'Long_Name',
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
      fieldPaths: [
        // XML fields to read from
        'Short_Name'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'Short_Name',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
        fieldPath: 'Long_Name',
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
      fieldPaths: [
        // XML fields to read from
        'Organization_Name/Short_Name'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'Organization_Name/Short_Name',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
        fieldPath: 'Organization_Name/Long_Name',
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
      fieldPaths: [
        // XML fields to read from
        'Type',
        'Subtype'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'Type',
        'Subtype'
      ]
    },
    replace: sequentialValueReplace([
      // XML fields to write to and keys from newKeywordObject to read from
      'Type',
      'Subtype'
    ]),
    removeNodeIfEmptyAfterReplace: true
  }),
  idnnode: blockScheme({
    nodeXPath: '//DIF/IDN_Node',
    find: {
      fieldPaths: [
        // XML fields to read from
        'Short_Name'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'Short_Name',
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
        // XML field to write to
        fieldPath: 'Long_Name',
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
  temporalresolutionrange: leafScheme({
    nodeXPath: '//DIF/Data_Resolution/Temporal_Resolution_Range',
    removeEmptyParent: true
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
    //     Value: 'NA'
    //   },
    //   newKeywordObject: {
    //     Value: '1A'
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
