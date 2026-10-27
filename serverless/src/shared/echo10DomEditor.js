import { CSV_FIELDS, ECHO10_FIELDS } from './redis-path-store/helpers/constants'
import XmlMetadataPathEditor, { sequentialValueReplace } from './XmlMetadataPathEditor'
import { trimString } from './XmlUtils'

const RELATED_URL_SUBTYPE_ABBREVIATIONS = new Map([
  ['ALGORITHM THEORETICAL BASIS DOCUMENT', 'ALGORITHM THEO BASIS'],
  ['CALIBRATION DATA DOCUMENTATION', 'CALIBRATION DATA'],
  ['PRODUCT QUALITY ASSESSMENT', 'PRODUCT QUALITY']
])

/**
 * Mirrors CMR's ECHO10 formatter: Type : Subtype when a subtype exists, otherwise
 * URLContentType : Type. Writing all three makes CMR's parser discard the subtype.
 * CMR abbreviates these long subtype names when translating to ECHO10 as well.
 */
const formatRelatedUrlType = (keywordObject) => {
  const { URLContentType, Type, Subtype } = keywordObject || {}
  const subtype = trimString(Subtype)
  const values = subtype
    ? [Type, RELATED_URL_SUBTYPE_ABBREVIATIONS.get(subtype) || subtype]
    : [URLContentType, Type]

  return values.map(trimString).filter(Boolean).join(' : ')
}

// CMR maps a Location hierarchy to its deepest populated value in SpatialKeywords/Keyword.
// Use CSV hierarchy order rather than object property order, and ignore trailing empty levels.
const getLocationLeafValue = (keywordObject) => CSV_FIELDS.locations
  .map((key) => trimString(keywordObject?.[key]))
  .filter(Boolean)
  .at(-1) || ''

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
      fieldPaths: ECHO10_FIELDS.sciencekeywords,
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
    // ordered ECHO10 XML fields:
    // - CategoryKeyword <- 'EARTH SCIENCE'
    // - TopicKeyword <- 'OCEANS'
    // - TermKeyword <- 'MARINE SEDIMENTS'
    replace: sequentialValueReplace(
      ECHO10_FIELDS.sciencekeywords,
      CSV_FIELDS.sciencekeywords
    )
  }),
  locations: (editor, correction) => {
    const oldValue = getLocationLeafValue(correction.oldKeywordObject)

    // An empty old hierarchy must never select the first keyword or create a new field.
    if (!oldValue) return false

    const updated = editor.updateScalarNode({
      ...correction,
      oldKeywordObject: { Value: oldValue },
      newKeywordObject: { Value: getLocationLeafValue(correction.newKeywordObject) }
    }, {
      nodeXPath: '//Collection/SpatialKeywords/Keyword'
    })

    if (updated && trimString(correction.action).toLowerCase() === 'delete') {
      editor.selectNodes('//Collection/SpatialKeywords')
        .forEach((node) => editor.removeNodeIfNoElementChildren(node))
    }

    return updated
  },
  platforms: blockScheme({
    // The platform CSV Category maps to the native ECHO10 <Type> field.
    nodeXPath: '//Collection/Platforms/Platform',
    find: {
      fieldPaths: [ECHO10_FIELDS.shortName],
      valueKeys: [CSV_FIELDS.shortName]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.platformType,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.category
        }
      },
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.longName,
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
    nodeXPath: '//Collection/Platforms/Platform/Instruments/Instrument',
    find: {
      fieldPaths: [ECHO10_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.longName,
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
      fieldPaths: [ECHO10_FIELDS.shortName],
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.shortName
      ]
    },
    replace: [
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.shortName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.longName,
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
      fieldPaths: ECHO10_FIELDS.providers,
      valueKeys: [
        // Keys from oldKeywordObject to compare against
        CSV_FIELDS.providerRole,
        CSV_FIELDS.shortName
      ]
    },
    delete: [
      {
        fieldPath: ECHO10_FIELDS.processingCenter,
        matchOldValueKey: CSV_FIELDS.shortName,
        condition: ({ correction, editor: currentEditor }) => (
          correction.oldKeywordObject?.[CSV_FIELDS.providerRole] === 'PROCESSOR'
          && currentEditor.resolveAbsoluteFieldElement(ECHO10_FIELDS.processingCenter, {
            expectedText: correction.oldKeywordObject?.[CSV_FIELDS.shortName]
          }) !== null
        )
      },
      {
        fieldPath: ECHO10_FIELDS.archiveCenter,
        matchOldValueKey: CSV_FIELDS.shortName,
        condition: ({ correction, editor: currentEditor }) => (
          correction.oldKeywordObject?.[CSV_FIELDS.providerRole] === 'ARCHIVER'
          && currentEditor.resolveAbsoluteFieldElement(ECHO10_FIELDS.archiveCenter, {
            expectedText: correction.oldKeywordObject?.[CSV_FIELDS.shortName]
          }) !== null
        )
      }
    ],
    replace: [
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.providerOrganizationName,
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.processingCenter,
        matchOldValueKey: CSV_FIELDS.shortName,
        // Condition to satisfy before replacement can occur
        condition: ({ correction, editor: currentEditor }) => (
          correction.oldKeywordObject?.[CSV_FIELDS.providerRole] === 'PROCESSOR'
          && currentEditor.resolveAbsoluteFieldElement(ECHO10_FIELDS.processingCenter, {
            expectedText: correction.oldKeywordObject?.[CSV_FIELDS.shortName]
          }) !== null
        ),
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      },
      {
        // XML field to write to
        fieldPath: ECHO10_FIELDS.archiveCenter,
        matchOldValueKey: CSV_FIELDS.shortName,
        // Condition to satisfy before replacement can occur
        condition: ({ correction, editor: currentEditor }) => (
          correction.oldKeywordObject?.[CSV_FIELDS.providerRole] === 'ARCHIVER'
          && currentEditor.resolveAbsoluteFieldElement(ECHO10_FIELDS.archiveCenter, {
            expectedText: correction.oldKeywordObject?.[CSV_FIELDS.shortName]
          }) !== null
        ),
        source: {
          // Key from newKeywordObject to read from
          type: 'value',
          key: CSV_FIELDS.shortName
        }
      }
    ]
  }),
  rucontenttype: (editor, correction) => {
    const oldKeyword = correction.oldKeywordObject || {}
    // Match complete native representations, never a substring. Retain compatibility with
    // legacy three-component values and unabbreviated subtypes, but always write CMR's form.
    const oldTypes = new Set([
      formatRelatedUrlType(oldKeyword),
      ...(trimString(oldKeyword.Subtype)
        ? [[oldKeyword.Type, oldKeyword.Subtype].map(trimString).filter(Boolean).join(' : ')]
        : []),
      CSV_FIELDS.rucontenttype.map((key) => trimString(oldKeyword[key])).filter(Boolean).join(' : ')
    ])

    return [...oldTypes].filter(Boolean).some((oldType) => editor.updateBlockNode(correction, {
      nodeXPath: '//Collection/OnlineResources/OnlineResource',
      find: {
        fieldPaths: ECHO10_FIELDS.rucontenttype,
        valueKeys: ['CombinedType'],
        getExpectedValueObject: () => ({ CombinedType: oldType })
      },
      replace: [
        {
          // Keep native output consistent with the same CMR mapping used for matching.
          fieldPath: ECHO10_FIELDS.relatedUrlType,
          source: {
            type: 'computed',
            getValue: () => formatRelatedUrlType(correction.newKeywordObject)
          }
        }
      ]
    }))
  },
  dataformat: scalarScheme({
    nodeXPath: '//Collection/DataFormat'
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
    // Scalar schemes only update an existing node matching oldKeywordObject when supplied.
    nodeXPath: '//Collection/ProcessingLevelId'
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
