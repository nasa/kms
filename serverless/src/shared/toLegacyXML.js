import { createChangeNote } from './createChangeNote'

/**
 * Converts a SKOS concept from a specific version to a legacy XML format.
 *
 * This function takes a SKOS concept and associated metadata from a particular version of the concept scheme,
 * and transforms it into a legacy XML structure. It processes various aspects of the concept including its
 * basic metadata, hierarchical relationships (broader and narrower), related concepts, definitions,
 * alternative labels, and associated resources.
 *
 * @function toLegacyXML
 * @param {Object} concept - The SKOS concept object to be transformed, from a specific version of the concept scheme.
 * @param {Array} conceptSchemeDetails - An array of concept scheme details for the specific version.
 * @param {Array} csvHeaders - An array of CSV headers for the specific version.
 * @param {Map<string, string>} prefLabelMap - A map of concept IRIs to their preferred labels for the specific version.
 * @param {string} schemeShortName - The short name of the concept scheme.
 * @returns {Object} An object representing the legacy XML structure of the concept.
 * @throws {Error} If no matching scheme is found for the provided schemeShortName.
 *
 * @example
 * // Convert a concept from the published version to legacy XML
 * const publishedConcept = { ... }; // SKOS concept object from the published version
 * const publishedSchemeDetails = [ ... ]; // Concept scheme details for the published version
 * const publishedCsvHeaders = [ ... ]; // CSV headers for the published version
 * const publishedPrefLabelMap = new Map([ ... ]); // Preferred label map for the published version
 *
 * const legacyXML = toLegacyXML(
 *   publishedConcept,
 *   publishedSchemeDetails,
 *   publishedCsvHeaders,
 *   publishedPrefLabelMap,
 *   'sciencekeywords'
 * );
 * console.log(JSON.stringify(legacyXML, null, 2));
 *
 * @note While this function doesn't directly use a version parameter, it assumes that all input data
 * (concept, conceptSchemeDetails, csvHeaders, and prefLabelMap) are from the same specific version
 * of the concept scheme. The version consistency should be managed by the calling function when
 * retrieving the concept and creating the necessary data structures.
 */
const toLegacyXML = (
  concept,
  conceptSchemeDetails,
  csvHeaders,
  prefLabelMap,
  schemeShortName
) => {
  // Helper function to retrieve parsed information in concept_schemes xml
  function findMatchingConceptScheme(schemeShortNameArg, conceptSchemes) {
    const matchingScheme = conceptSchemes.find(
      (scheme) => scheme.notation.toLowerCase() === schemeShortNameArg.toLowerCase()
    )

    if (!matchingScheme) {
      throw new Error(`No matching scheme found for: ${schemeShortNameArg}`)
    }

    return {
      schemeLongName: matchingScheme.prefLabel,
      schemeVersionDate: matchingScheme.modified
    }
  }

  // Helper function to determine if there are multiple altLabels and assist in translating the different types
  function processAltLabels(altLabels) {
    const labelsArray = Array.isArray(altLabels) ? altLabels : [altLabels]

    return labelsArray.map((label) => ({
      '@category': label['@gcmd:category'],
      '#text': label['@gcmd:text']
    }))
  }

  const uuid = concept['@rdf:about']

  // Finding the appropriate shortName and longName for scheme
  const matchingSchemeDetails = findMatchingConceptScheme(schemeShortName, conceptSchemeDetails)
  const { schemeLongName, schemeVersionDate } = matchingSchemeDetails

  const conceptObj = {
    concept: {
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@isRoot': !concept['skos:broader'],
      '@lang': 'en',
      '@uuid': uuid,
      '@xsi:noNamespaceSchemaLocation': 'https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd',
      termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
      keywordVersion: '20.8',
      schemeVersion: schemeVersionDate,
      viewer: `https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/${schemeShortName}/${uuid}`,
      // eslint-disable-next-line no-underscore-dangle
      prefLabel: concept['skos:prefLabel']._text,
      ...(concept['gcmd:altLabel'] ? {
        altLabels: {
          altLabel: processAltLabels(concept['gcmd:altLabel'])
        }
      } : {
        altLabels: null
      }),
      ...(concept['skos:definition'] ? {
        definition: {
          '@reference': concept['gcmd:reference'] ? concept['gcmd:reference']['@gcmd:text'] : '',
          // eslint-disable-next-line no-underscore-dangle
          '#text': concept['skos:definition']._text
        }
      } : {}),
      altSymbols: {},
      broader: concept['skos:broader'] ? {
        conceptBrief: {
          '@conceptScheme': schemeShortName,
          '@prefLabel': prefLabelMap.get(concept['skos:broader']['@rdf:resource']),
          '@uuid': concept['skos:broader']['@rdf:resource']
        }
      } : {},
      narrower: (() => {
        if (!concept['skos:narrower']) {
          return {}
        }

        const narrowerArray = Array.isArray(concept['skos:narrower'])
          ? concept['skos:narrower']
          : [concept['skos:narrower']]

        const conceptBrief = narrowerArray.map((narrower) => ({
          '@conceptScheme': schemeShortName,
          '@prefLabel': prefLabelMap.get(narrower['@rdf:resource']),
          '@uuid': narrower['@rdf:resource']
        }))

        return {
          conceptBrief
        }
      })(),
      conceptScheme: {
        '@csvHeaders': csvHeaders.join(','),
        '@longName': schemeLongName,
        '@name': schemeShortName
      },
      related: (() => {
        const relations = []

        // Handle gcmd:hasInstrument
        if (concept['gcmd:hasInstrument']) {
          const instruments = Array.isArray(concept['gcmd:hasInstrument'])
            ? concept['gcmd:hasInstrument']
            : [concept['gcmd:hasInstrument']]

          instruments.forEach((instrument) => {
            relations.push({
              '@type': 'has_instrument',
              '@generatedBy': 'server',
              '@conceptScheme': 'instruments',
              '@prefLabel': prefLabelMap.get(instrument['@rdf:resource']),
              '@uuid': instrument['@rdf:resource']
            })
          })
        }

        // Handle gcmd:isOnPlatform
        if (concept['gcmd:isOnPlatform']) {
          relations.push({
            '@type': 'is_on_platform',
            '@generatedBy': 'server',
            '@conceptScheme': 'platforms',
            '@prefLabel': prefLabelMap.get(concept['gcmd:isOnPlatform']['@rdf:resource']),
            '@uuid': concept['gcmd:isOnPlatform']['@rdf:resource']
          })
        }

        return relations.length > 0 ? { weightedRelation: relations } : {}
      })(),

      ...(concept['gcmd:resource'] ? {
        resources: {
          resource: {
            '@type': concept['gcmd:resource']['@gcmd:type'],
            '#text': concept['gcmd:resource']['@gcmd:url']
          }
        }
      } : {}),
      ...(concept['skos:changeNote'] ? {
        changeNotes: {
          changeNote: Array.isArray(concept['skos:changeNote'])
            ? concept['skos:changeNote'].map(createChangeNote)
            : createChangeNote(concept['skos:changeNote'])
        }
      } : {}),
      ...(concept['dcterms:modified'] && {
        lastModifiedDate: concept['dcterms:modified'].split(' ')[0]
      })
    }
  }

  return conceptObj
}

export default toLegacyXML
