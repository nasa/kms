/**
 * Converts a SKOS concept to a legacy JSON format.
 *
 * This function takes a SKOS concept and associated metadata, and transforms it into a legacy JSON structure.
 * It processes various aspects of the concept including its basic metadata, hierarchical relationships (broader and narrower),
 * related concepts, definitions, alternative labels, and associated resources.
 *
 * @async
 * @function toLegacyJSON
 * @param {Object} skosConcept - The SKOS concept object to be transformed.
 * @param {Map<string, string>} conceptSchemeMap - A map of concept scheme short names to their long names.
 * @param {Map<string, string>} prefLabelMap - A map of concept IRIs to their preferred labels.
 * @returns {Promise<Object>} A promise that resolves to the transformed legacy JSON object.
 * @throws {Error} If there's an error during the conversion process.
 *
 * @property {string} termsOfUse - The URL to the terms of use document.
 * @property {string} keywordVersion - The version of the keyword set.
 * @property {string} schemeVersion - The version of the concept scheme.
 * @property {string} viewer - The URL to view the concept in the GCMD Keyword Viewer.
 * @property {string} lastModifiedDate - The date when the concept was last modified.
 * @property {string} uuid - The unique identifier of the concept.
 * @property {string} prefLabel - The preferred label of the concept.
 * @property {boolean} isLeaf - Indicates whether the concept is a leaf node in the hierarchy.
 * @property {Object} scheme - Information about the concept's scheme.
 * @property {Array<Object>} broader - An array of broader concepts.
 * @property {Array<Object>} narrower - An array of narrower concepts.
 * @property {Array<Object>} related - An array of related concepts.
 * @property {Array<Object>} definitions - An array of concept definitions.
 * @property {Array<Object>} altLabels - An array of alternative labels for the concept.
 * @property {Array<Object>} resources - An array of associated resources.
 *
 * @example
 * try {
 *   const skosConcept = { ... }; // SKOS concept object
 *   const conceptSchemeMap = new Map([['scheme1', 'Scheme One'], ...]);
 *   const prefLabelMap = new Map([['http://example.com/concept/1', 'Concept One'], ...]);
 *
 *   const legacyJSON = await toLegacyJSON(skosConcept, conceptSchemeMap, prefLabelMap);
 *   console.log('Transformed legacy JSON:', legacyJSON);
 * } catch (error) {
 *   console.error('Error converting to legacy JSON:', error);
 * }
 */

// Helper function to determine if there are multiple altLabels and assist in translating the different types
function processAltLabels(altLabels) {
  if (!altLabels) {
    return []
  }

  const labelArray = Array.isArray(altLabels) ? altLabels : [altLabels]

  return labelArray.map((label) => {
    const processedLabel = {}

    if (label['@gcmd:category']) {
      processedLabel.category = label['@gcmd:category']
    }

    processedLabel.text = label['@gcmd:text']

    return processedLabel
  })
}

const toLegacyJSON = (skosConcept, conceptSchemeMap, prefLabelMap) => {
  try {
    // Extract the UUID from the @rdf:about field
    const uuid = skosConcept['@rdf:about']

    // Extract scheme information
    const schemeResource = skosConcept['skos:inScheme']['@rdf:resource']
    const schemeShortName = schemeResource.split('/').pop()
    const schemeLongName = conceptSchemeMap.get(schemeShortName)

    // Transform the data
    const transformedData = {
      termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
      keywordVersion: '20.6',
      schemeVersion: '2025-01-31 11:22:12', // Corrolates with the change of keywordVersion
      viewer: `https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/${schemeShortName}/${uuid}`,
      lastModifiedDate: skosConcept['dcterms:modified'],
      uuid,
      // eslint-disable-next-line no-underscore-dangle
      prefLabel: skosConcept['skos:prefLabel']._text,
      isLeaf: !skosConcept['skos:narrower'],
      scheme: {
        shortName: schemeShortName,
        longName: schemeLongName
      },
      broader: skosConcept['skos:broader'] ? [{
        uuid: skosConcept['skos:broader']['@rdf:resource'],
        prefLabel: prefLabelMap.get(skosConcept['skos:broader']['@rdf:resource']),
        scheme: {
          shortName: schemeShortName,
          longName: schemeLongName
        }
      }] : [],
      narrower: (skosConcept['skos:narrower'] || []).map((narrow) => ({
        uuid: narrow['@rdf:resource'],
        prefLabel: prefLabelMap.get(narrow['@rdf:resource']),
        scheme: {
          shortName: schemeShortName,
          longName: schemeLongName
        }
      })),
      related: (skosConcept['skos:related'] || []).map((relation) => ({
        uuid: relation['@rdf:resource'],
        prefLabel: prefLabelMap.get(relation['@rdf:resource']),
        scheme: {
          shortName: schemeShortName,
          longName: schemeLongName
        },
        type: skosConcept['gcmd:type'].replace(/([A-Z])/g, '_$1').toLowerCase()
      })),
      definitions: skosConcept['skos:definition'] ? [{
        // eslint-disable-next-line no-underscore-dangle
        text: skosConcept['skos:definition']._text,
        reference: skosConcept['gcmd:reference'] && skosConcept['gcmd:reference']['@gcmd:text']
          ? skosConcept['gcmd:reference']['@gcmd:text']
          : ''
      }] : [],
      altLabels: processAltLabels(skosConcept['gcmd:altLabel']),
      resources: skosConcept['gcmd:resource'] ? [{
        type: skosConcept['gcmd:resource']['@gcmd:type'],
        url: skosConcept['gcmd:resource']['@gcmd:url']
      }] : []
    }

    return transformedData
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}

export default toLegacyJSON
