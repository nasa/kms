import { getTriplesForAltLabelQuery } from '@/shared/operations/queries/getTriplesForAltLabelQuery'
import { getTriplesForConceptQuery } from '@/shared/operations/queries/getTriplesForConceptQuery'
import {
  getTriplesForShortNameQuery
} from '@/shared/operations/queries/getTriplesForShortNameQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { toSkosJson } from '@/shared/toSkosJson'

import { escapeSparqlString } from './escapeSparqlString'
import {
  getTriplesForConceptFullPathQuery
} from './operations/queries/getTriplesForConceptFullPathQuery'

/**
 * Determines the scheme name based on the full path of a concept.
 *
 * @param {string} fullPath - The full path of the concept, including scheme and hierarchy, separated by '|'.
 * @returns {string} The determined scheme name preserving original casing.
 *
 * @description
 * This function extracts the scheme name from the full path and applies special logic for science keywords.
 * If the scheme starts with certain science-related phrases, it returns 'Science Keywords'.
 * Otherwise, it returns the scheme name as-is.
 */
const getSchemeName = (fullPath) => {
  // Extract the scheme name from the first part of the full path
  const scheme = fullPath.split('|')[0]
  // Define phrases that indicate a science keyword scheme
  const scienceKeywordsStartPhrases = ['science keywords', 'earth science', 'earth science services']
  // Check if the scheme starts with any of the science keyword phrases
  if (scienceKeywordsStartPhrases.some((phrase) => scheme.toLowerCase().startsWith(phrase))) {
    return 'Science Keywords'
  }

  return scheme
}

/**
 * Retrieves and processes SKOS concept data for a specific version.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query based on the provided identifier (conceptIRI, shortName, or altLabel).
 * 2. Sends a SPARQL request to retrieve the concept data for the specified version.
 * 3. Processes the SPARQL results and converts them into a SKOS JSON format.
 *
 * The SPARQL query retrieves:
 * - All direct properties of the concept.
 * - All properties of blank nodes connected to the concept.
 *
 * @async
 * @function getSkosConcept
 * @param {Object} options - The options for retrieving the SKOS concept.
 * @param {string} [options.conceptIRI] - The IRI of the SKOS concept to retrieve.
 * @param {string} [options.shortName] - The short name of the SKOS concept to retrieve.
 * @param {string} [options.altLabel] - The alternative label of the SKOS concept to retrieve.
 * @param {string} [options.fullPath] - The full path of the concept, including scheme and hierarchy, separated by '|'.
 * @param {string} [options.scheme] - The scheme to filter the concept search (used with shortName or altLabel).
 * @param {string} options.version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 *
 * @returns {Promise<Object|null>} A promise that resolves to the SKOS concept data in JSON format, or null if no concept is found.
 *
 * @throws {Error} If neither conceptIRI, shortName, nor altLabel is provided.
 * @throws {Error} If the HTTP request fails or if there's an error during the fetching or processing of the concept data.
 *
 * @example
 * // Retrieve by conceptIRI from the published version
 * try {
 *   const conceptData = await getSkosConcept({
 *     conceptIRI: 'http://example.com/concept/123',
 *     version: 'published'
 *   });
 *   console.log(conceptData);
 * } catch (error) {
 *   console.error('Failed to get concept:', error);
 * }
 *
 * @example
 * // Retrieve by shortName from the draft version
 * try {
 *   const conceptData = await getSkosConcept({
 *     shortName: 'Earth Science',
 *     scheme: 'sciencekeywords',
 *     version: 'draft'
 *   });
 *   console.log(conceptData);
 * } catch (error) {
 *   console.error('Failed to get concept:', error);
 * }
 *
 * @example
 * // Retrieve by altLabel from a specific version
 * try {
 *   const conceptData = await getSkosConcept({
 *     altLabel: 'ES',
 *     scheme: 'sciencekeywords',
 *     version: '9.1.5'
 *   });
 *   console.log(conceptData);
 * } catch (error) {
 *   console.error('Failed to get concept:', error);
 * }
 *
 * @example
 * // Retrieve by fullPath from the published version
 * try {
 *   const conceptData = await getSkosConcept({
 *     fullPath: 'Earth Science|Atmosphere|Atmospheric Temperature|Surface Temperature',
 *     version: 'published'
 *   });
 *   console.log(conceptData);
 * } catch (error) {
 *   console.error('Failed to get concept:', error);
 * }
 *
 * // Example output:
 * // {
 * //   "@rdf:about": "http://example.com/concept/123",
 * //   "skos:prefLabel": {
 * //     "_text": "Example Concept",
 * //     "@xml:lang": "en"
 * //   },
 * //   "skos:definition": {
 * //     "_text": "This is an example SKOS concept.",
 * //     "@xml:lang": "en"
 * //   },
 * //   "skos:broader": {
 * //     "@rdf:resource": "http://example.com/concept/parent"
 * //   },
 * //   "skos:narrower": [
 * //     { "@rdf:resource": "http://example.com/concept/child1" },
 * //     { "@rdf:resource": "http://example.com/concept/child2" }
 * //   ],
 * //   "dcterms:created": "2023-01-15",
 * //   "dcterms:modified": "2023-06-30"
 * // }
 *
 * @see sparqlRequest - For details on how the SPARQL query is executed.
 * @see toSkosJson - For details on how the SPARQL results are converted to SKOS JSON.
 * @see getTriplesForConceptQuery - For the SPARQL query used when retrieving by conceptIRI.
 * @see getTriplesForShortNameQuery - For the SPARQL query used when retrieving by shortName.
 * @see getTriplesForAltLabelQuery - For the SPARQL query used when retrieving by altLabel.
 */
export const getSkosConcept = async ({
  conceptIRI, shortName, altLabel, fullPath, scheme, version
}) => {
  let sparqlQuery

  if (conceptIRI) {
    sparqlQuery = getTriplesForConceptQuery(conceptIRI)
  } else if (shortName) {
    sparqlQuery = getTriplesForShortNameQuery({
      shortName,
      scheme
    })
  } else if (altLabel) {
    sparqlQuery = getTriplesForAltLabelQuery({
      altLabel,
      scheme
    })
  } else if (fullPath) {
    // Split the fullPath into levels using '|' as a separator
    const levels = fullPath.split('|').map((level) => escapeSparqlString(level.trim()))
    // Ensure that the fullPath contains at least two levels (scheme and concept)
    if (levels.length < 2) {
      throw new Error('fullPath must contain at least two elements separated by "|"')
    }

    // Determine the scheme name from the fullPath
    const schemeFromFullPath = getSchemeName(fullPath)

    // Extract the target concept (last element in the levels array)
    const targetConcept = levels[levels.length - 1]

    // Construct the SPARQL query for retrieving concept data based on its full path
    sparqlQuery = getTriplesForConceptFullPathQuery({
      levels,
      scheme: escapeSparqlString(schemeFromFullPath),
      targetConcept
    })
  } else {
    throw new Error('Either conceptIRI, shortName, altLabel or fullPath must be provided')
  }

  try {
    const response = await sparqlRequest({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: sparqlQuery,
      version
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    if (json.results.bindings.length === 0) {
      return null
    }

    let fetchedConceptIRI = conceptIRI
    if (!fetchedConceptIRI) {
      // If shortName was used, find the conceptIRI from the results
      const conceptTriple = json.results.bindings.find((triple) => triple.p.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
        && triple.o.value === 'http://www.w3.org/2004/02/skos/core#Concept')

      if (!conceptTriple) {
        throw new Error('Could not find concept URI in retrieved concept')
      }

      fetchedConceptIRI = conceptTriple.s.value
    }

    return toSkosJson(fetchedConceptIRI, json.results.bindings)
  } catch (error) {
    console.error('Error fetching SKOS concept:', error)
    throw error
  }
}
