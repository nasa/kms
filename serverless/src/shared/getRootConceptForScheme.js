// Import the query function for getting the root concept
import { castArray } from 'lodash'

import {
  getRootConceptsBySchemeQuery
} from '@/shared/operations/queries/getRootConceptsBySchemeQuery'

// Import the function for making SPARQL requests
import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches the root concept(s) for a given scheme and version.
 *
 * This function sends a SPARQL query to retrieve the root concept(s) of a specified
 * concept scheme. It handles the query execution, response parsing, and error checking.
 *
 * @async
 * @function getRootConceptForScheme
 * @param {string} scheme - The scheme identifier for which to fetch the root concept(s).
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of root concept objects.
 * @throws {Error} If there's an HTTP error, no root concept is found, or any other error occurs.
 *
 * @example
 * try {
 *   const rootConcepts = await getRootConceptForScheme('science_keywords', 'published');
 *   console.log(rootConcepts);
 *   // Example output:
 *   // [{
 *   //   subject: { value: "https://gcmd.earthdata.nasa.gov/kms/concepts/2056e9d5-1025-40c8-88c4-1ab6f62f968a" },
 *   //   prefLabel: { value: "EARTH SCIENCE" }
 *   // }]
 * } catch (error) {
 *   console.error('Failed to fetch root concept:', error);
 * }
 *
 * @example
 * try {
 *   const rootConcepts = await getRootConceptForScheme('non_existent_scheme', 'published');
 * } catch (error) {
 *   console.error(error.message);
 *   // Expected output: "No root concept found for scheme: non_existent_scheme"
 * }
 *
 * @see {@link getRootConceptsBySchemeQuery}
 * @see {@link sparqlRequest}
 */
export const getRootConceptForScheme = async (scheme, version) => {
  try {
    // Make a SPARQL request to get the root concept
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getRootConceptsBySchemeQuery(scheme, version),
      version,
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '30000', 10)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Check if any results were returned
    if (json.results.bindings.length === 0) {
      throw new Error(`No root concept found for scheme: ${scheme}`)
    }

    // Return the first (and presumably only) result
    return castArray(json.results.bindings)
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error fetching root concept:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
