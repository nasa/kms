/**
 * Converts a SKOS concept from a specific version to a legacy JSON format.
 *
 * This function takes a SKOS concept and associated metadata from a particular version of the concept scheme,
 * and transforms it into a legacy JSON structure. It processes various aspects of the concept including its
 * basic metadata, hierarchical relationships (broader and narrower), related concepts, definitions,
 * alternative labels, and associated resources.
 *
 * @function toLegacyJSON
 * @param {Object} concept - The SKOS concept object to be transformed, from a specific version of the concept scheme.
 * @param {Map<string, string>} conceptSchemeMap - A map of concept scheme short names to their long names.
 * @param {Map<string, string>} conceptToConceptSchemeShortNameMap - A map of concept IRIs to their scheme short names.
 * @param {Map<string, string>} prefLabelMap - A map of concept IRIs to their preferred labels.
 * @param {string} keywordVersion - The version of the keyword set.
 * @param {string} versionCreationDate - The creation date of the version, used as the scheme version.
 * @returns {Object} The transformed legacy JSON object.
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
 * // Convert a concept from the published version to legacy JSON
 * try {
 *   const concept = { ... }; // SKOS concept object from the published version
 *   const conceptSchemeMap = new Map([['scheme1', 'Scheme One'], ...]);
 *   const conceptToConceptSchemeShortNameMap = new Map([['http://example.com/concept/1', 'scheme1'], ...]);
 *   const prefLabelMap = new Map([['http://example.com/concept/1', 'Concept One'], ...]);
 *   const keywordVersion = '10.0';
 *   const versionCreationDate = '2023-06-01'
 *
 *   const legacyJSON = toLegacyJSON(
 *     concept,
 *     conceptSchemeMap,
 *     conceptToConceptSchemeShortNameMap,
 *     prefLabelMap,
 *     keywordVersion,
 *     versionCreationDate
 *   )
 *   console.log('Transformed legacy JSON:', legacyJSON);
 * } catch (error) {
 *   console.error('Error converting to legacy JSON:', error);
 * }
 *
 * @note While this function doesn't directly use a version parameter, it assumes that the input concept
 * and associated maps are from a specific version of the concept scheme. The version information should
 * be managed by the calling function when retrieving the concept and creating the necessary maps.
 */

import { castArray } from 'lodash'

export const toLegacyJSON = (
  concept,
  conceptSchemeMap,
  conceptToConceptSchemeShortNameMap,
  prefLabelMap,
  keywordVersion,
  versionCreationDate
) => {
  // Helper function to determine if there are multiple altLabels and assist in translating the different types
  const processAltLabels = (altLabels) => {
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

  try {
    // Extract the UUID from the @rdf:about field
    const uuid = concept['@rdf:about']

    // Extract scheme information
    const schemeShortName = conceptToConceptSchemeShortNameMap.get(uuid)
    const schemeLongName = conceptSchemeMap.get(schemeShortName)
    const broaderShortName = concept['skos:broader'] ? conceptToConceptSchemeShortNameMap.get(concept['skos:broader']['@rdf:resource']) : null
    const broaderLongName = conceptSchemeMap.get(broaderShortName)

    // Transform the data
    const transformedData = {
      termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
      keywordVersion,
      schemeVersion: versionCreationDate, // Corrolates with the change of keywordVersion
      viewer: `https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/${schemeShortName}/${uuid}`,
      lastModifiedDate: concept['dcterms:modified'],
      uuid,
      // eslint-disable-next-line no-underscore-dangle
      prefLabel: concept['skos:prefLabel']._text,
      isLeaf: !concept['skos:narrower'],
      scheme: {
        shortName: schemeShortName,
        longName: schemeLongName
      },
      broader: concept['skos:broader'] ? [{
        uuid: concept['skos:broader']['@rdf:resource'],
        prefLabel: prefLabelMap.get(concept['skos:broader']['@rdf:resource']),
        scheme: {
          shortName: broaderShortName,
          longName: broaderLongName
        }
      }] : [],
      narrower: (() => {
        const narrower = concept['skos:narrower']
        if (!narrower) return []

        const narrowerArray = Array.isArray(narrower) ? narrower : [narrower]

        return narrowerArray.map((narrow) => {
          const narrowerShortName = conceptToConceptSchemeShortNameMap.get(narrow['@rdf:resource'])
          const narrowerLongName = conceptSchemeMap.get(narrowerShortName)

          return {
            uuid: narrow['@rdf:resource'],
            prefLabel: prefLabelMap.get(narrow['@rdf:resource']),
            scheme: {
              shortName: narrowerShortName,
              longName: narrowerLongName
            }
          }
        })
      })(),
      related: (() => {
        const relations = []

        // Helper function to process a single relation
        const processRelation = (relation, type) => {
          const relationUuid = relation['@rdf:resource']
          const relatedShortName = conceptToConceptSchemeShortNameMap.get(relationUuid)
          const relatedLongName = conceptSchemeMap.get(relatedShortName)

          const result = {
            uuid: relationUuid,
            prefLabel: prefLabelMap.get(uuid),
            scheme: {
              shortName: relatedShortName,
              longName: relatedLongName
            }
          }
          if (type) {
            result.type = type
          }

          return result
        }

        // Handle gcmd:hasInstrument
        if (concept['gcmd:hasInstrument']) {
          const instruments = castArray(concept['gcmd:hasInstrument'])
          instruments.forEach((instrument) => relations.push(processRelation(instrument, 'has_instrument')))
        }

        // Handle gcmd:hasSensor
        if (concept['gcmd:hasSensor']) {
          const sensors = castArray(concept['gcmd:hasSensor'])
          sensors.forEach((sensor) => relations.push(processRelation(sensor, 'has_sensor')))
        }

        // Handle gcmd:isOnPlatform
        if (concept['gcmd:isOnPlatform']) {
          const platforms = castArray(concept['gcmd:isOnPlatform'])
          platforms.forEach((platform) => relations.push(processRelation(platform, 'is_on_platform')))
        }

        // Handle skos:related
        if (concept['skos:related']) {
          const related = castArray(concept['skos:related'])
          related.forEach((relatedItem) => relations.push(processRelation(relatedItem, null)))
        }

        return relations
      })(),
      definitions: concept['skos:definition'] ? [{
        // eslint-disable-next-line no-underscore-dangle
        text: concept['skos:definition']._text,
        reference: concept['gcmd:reference'] && concept['gcmd:reference']['@gcmd:text']
          ? concept['gcmd:reference']['@gcmd:text']
          : ''
      }] : [],
      altLabels: processAltLabels(concept['gcmd:altLabel']),
      resources: concept['gcmd:resource'] ? [{
        type: concept['gcmd:resource']['@gcmd:type'],
        url: concept['gcmd:resource']['@gcmd:url']
      }] : []
    }

    return transformedData
  } catch (error) {
    console.error(`Error converting concept to JSON: ${error.message}`)
    throw new Error(`Failed to convert concept to JSON: ${error.message}`)
  }
}

export default toLegacyJSON
