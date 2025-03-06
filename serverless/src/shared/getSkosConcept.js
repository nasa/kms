import { getTriplesForAltLabelQuery } from '@/shared/operations/queries/getTriplesForAltLabelQuery'
import { getTriplesForConceptQuery } from '@/shared/operations/queries/getTriplesForConceptQuery'
import {
  getTriplesForShortNameQuery
} from '@/shared/operations/queries/getTriplesForShortNameQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { toSkosJson } from '@/shared/toSkosJson'

/**
 * Retrieves and processes SKOS concept data.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query based on the provided identifier (conceptIRI, shortName, or altLabel).
 * 2. Sends a SPARQL request to retrieve the concept data.
 * 3. Processes the SPARQL results and converts them into a SKOS JSON format.
 *
 * The SPARQL query retrieves:
 * - All direct properties of the concept.
 * - All properties of blank nodes connected to the concept.
 *
 * @param {Object} options - The options for retrieving the SKOS concept.
 * @param {string} [options.conceptIRI] - The IRI of the SKOS concept to retrieve.
 * @param {string} [options.shortName] - The short name of the SKOS concept to retrieve.
 * @param {string} [options.altLabel] - The alternative label of the SKOS concept to retrieve.
 * @param {string} [options.scheme] - The scheme to filter the concept search (used with shortName or altLabel).
 *
 * @returns {Promise<Object>} A promise that resolves to the SKOS concept data in JSON format.
 *
 * @throws {Error} If neither conceptIRI, shortName, nor altLabel is provided.
 * @throws {Error} If the HTTP request fails, if no results are found for the concept,
 *                 or if there's an error during the fetching or processing of the concept data.
 *
 * @example
 * // Retrieve by conceptIRI
 * try {
 *   const conceptData = await getSkosConcept({ conceptIRI: 'http://example.com/concept/123' });
 *   console.log(conceptData);
 * } catch (error) {
 *   console.error('Failed to get concept:', error);
 * }
 *
 * @example
 * // Retrieve by shortName
 * try {
 *   const conceptData = await getSkosConcept({ shortName: 'Earth Science', scheme: 'sciencekeywords' });
 *   console.log(conceptData);
 * } catch (error) {
 *   console.error('Failed to get concept:', error);
 * }
 *
 * @example
 * // Retrieve by altLabel
 * try {
 *   const conceptData = await getSkosConcept({ altLabel: 'ES', scheme: 'sciencekeywords' });
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
  conceptIRI, shortName, altLabel, scheme, version
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
  } else {
    throw new Error('Either conceptIRI, shortName, or altLabel must be provided')
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
