import XmlMetadataPathEditor, { sequentialValueReplace } from './XmlMetadataPathEditor'

// Wrap a block-style scheme config in the shared editor contract used by the ECHO10 delegate.
const blockScheme = (config) => (editor, correction) => editor.updateBlockNode(correction, config)
// Wrap a scalar/root-field scheme config in the shared editor contract used by the ECHO10 delegate.
const scalarScheme = (config) => (editor, correction) => editor.updateScalarNode(correction, config)

/**
 * ECHO10 scheme configuration for the shared XML path editor.
 *
 * The object keys here are the incoming KMS scheme names from `correction.scheme`
 * (for example `sciencekeywords`, `platforms`, or `providers`). The ECHO10 delegate
 * lowercases `correction.scheme` and uses it to look up the matching function in
 * this map, so these keys are dispatch identifiers, not ECHO10 XML tag names.
 *
 * Each scheme describes:
 * - the XPath used to find candidate ECHO10 nodes
 * - how to match the current normalized keyword object from XML content
 * - how replacement values map back into ECHO10 fields
 *
 * @type {Object.<string, Function>}
 */
export const ECHO10_SCHEME_EDITORS = {
  sciencekeywords: blockScheme({
    nodeXPath: '//Collection/ScienceKeywords/ScienceKeyword',
    removeEmptyParent: true,
    find: {
      fieldPaths: [
        // XML fields to read from
        'CategoryKeyword',
        'TopicKeyword',
        'TermKeyword',
        'VariableLevel1Keyword/Value',
        'VariableLevel1Keyword/VariableLevel2Keyword/Value',
        'VariableLevel1Keyword/VariableLevel2Keyword/VariableLevel3Keyword/Value',
        'DetailedVariableKeyword'
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
    // ordered ECHO10 XML fields:
    // - CategoryKeyword <- 'EARTH SCIENCE'
    // - TopicKeyword <- 'OCEANS'
    // - TermKeyword <- 'MARINE SEDIMENTS'
    replace: sequentialValueReplace(
      [
        // XML fields to write to
        'CategoryKeyword',
        'TopicKeyword',
        'TermKeyword',
        'VariableLevel1Keyword/Value',
        'VariableLevel1Keyword/VariableLevel2Keyword/Value',
        'VariableLevel1Keyword/VariableLevel2Keyword/VariableLevel3Keyword/Value',
        'DetailedVariableKeyword'
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
  platforms: blockScheme({
    // Platform corrections are normalized into an object that can carry:
    // - Class: the GCMD platform class, for example "Space-based Platforms"
    // - Type: ECHO10 <Type>
    // - ShortName: ECHO10 <Short_Name>
    //
    // ECHO10 Platform only persists `Type` and `ShortName`, so those are the
    // only object fields written back into the XML.
    nodeXPath: '//Collection/Platforms/Platform',
    find: {
      fieldPaths: [
        // XML fields to read from
        'ShortName'
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
        fieldPath: 'ShortName',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
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
  instruments: blockScheme({
    nodeXPath: '//Collection/Platforms/Platform/Instruments/Instrument',
    find: {
      fieldPaths: [
        // XML fields to read from
        'ShortName'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'ShortName',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
        fieldPath: 'LongName',
        source: {
          // Correction param to read from
          type: 'param',
          key: 'newLongName'
        }
      }
    ]
  }),
  projects: blockScheme({
    nodeXPath: '//Collection/Campaigns/Campaign',
    find: {
      fieldPaths: [
        // XML fields to read from
        'ShortName'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'ShortName',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
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
    nodeXPath: '//Collection/Contacts/Contact',
    removeEmptyParent: true,
    find: {
      fieldPaths: [
        // XML fields to read from
        'Role',
        'OrganizationName'
      ],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        'BucketLevel0',
        'ShortName'
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: 'OrganizationName',
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
        fieldPath: '//Collection/ProcessingCenter',
        // Condition to satisfy before replacement can occur
        condition: ({ correction, editor: currentEditor }) => (
          correction.oldKeywordObject?.BucketLevel0 === 'PROCESSOR'
          && currentEditor.getNestedText(null, '//Collection/ProcessingCenter')
          === correction.oldKeywordObject?.ShortName
        ),
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      },
      {
        // XML field to write to
        fieldPath: '//Collection/ArchiveCenter',
        // Condition to satisfy before replacement can occur
        condition: ({ correction, editor: currentEditor }) => (
          correction.oldKeywordObject?.BucketLevel0 === 'ARCHIVER'
          && currentEditor.getNestedText(null, '//Collection/ArchiveCenter')
          === correction.oldKeywordObject?.ShortName
        ),
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: 'ShortName'
        }
      }
    ]
  }),
  rucontenttype: blockScheme({
    nodeXPath: '//Collection/OnlineResources/OnlineResource',
    find: {
      fieldPaths: [
        // XML fields to read from
        'Type'
      ],
      valueKeys: ['CombinedType'],
      getExpectedValueObject: ({ correction }) => ({
        CombinedType: [
          correction.oldKeywordObject?.URLContentType,
          correction.oldKeywordObject?.Type,
          correction.oldKeywordObject?.Subtype
        ].filter(Boolean).join(' : ')
      })
    },
    replace: [
      {
        // XML fields to write to and keys from newKeywordObject to read from
        fieldPath: 'Type',
        source: {
          type: 'computed',
          getValue: ({ correction }) => [
            correction.newKeywordObject?.URLContentType,
            correction.newKeywordObject?.Type,
            correction.newKeywordObject?.Subtype
          ].filter(Boolean).join(' : ')
        }
      }
    ]
  }),
  dataformat: scalarScheme({
    nodeXPath: '//Collection/DataFormat',
    tagName: 'DataFormat'
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
    nodeXPath: '//Collection/ProcessingLevelId',
    tagName: 'ProcessingLevelId'
  })
}

/**
 * Creates a DOM-backed editor for a raw ECHO10 XML payload.
 *
 * @param {string} metadataPayload Raw ECHO10 XML string.
 * @returns {XmlMetadataPathEditor} Shared XML path editor instance.
 */
export const createEcho10Editor = (metadataPayload) => new XmlMetadataPathEditor(metadataPayload)

export default ECHO10_SCHEME_EDITORS
