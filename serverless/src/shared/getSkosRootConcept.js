import {
  getTriplesForRootConceptQuery
} from '@/shared/operations/queries/getTriplesForRootConceptQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { toSkosJson } from './toSkosJson'

/**
 * Fetches and processes the SKOS root concept for a given scheme.
 *
 * @async
 * @function getSkosRootConcept
 * @param {string} schemeId - The ID of the SKOS scheme.
 * @param {string} version - The version of the SKOS scheme.
 * @returns {Promise<Object|null>} The processed SKOS root concept data, or null if not found.
 * @throws {Error} If there's an HTTP error or any other error during the process.
 */
export const getSkosRootConcept = async (schemeId, version) => {
  try {
    // Make a SPARQL request to fetch the root concept data
    const response = await sparqlRequest({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: getTriplesForRootConceptQuery(schemeId),
      version
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()
    // If no results are found, return null
    if (json.results.bindings.length === 0) {
      return null
    }

    // Get the subject (s) value from the first binding
    const conceptIRI = json.results.bindings[0].s.value

    // Process and return the SKOS data
    return toSkosJson(conceptIRI, json.results.bindings)
  } catch (error) {
    console.error('Error fetching SKOS root concept:', error)
    throw error
  }
}
