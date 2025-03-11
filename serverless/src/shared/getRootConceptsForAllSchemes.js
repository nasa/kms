import {
  getRootConceptsBySchemeQuery
} from '@/shared/operations/queries/getRootConceptsBySchemeQuery'

import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches all root concepts across all schemes.
 *
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of root concept objects.
 * @throws {Error} If there's an HTTP error, no root concepts are found, or any other error occurs.
 *
 * @example
 * // Fetch all root concepts
 * try {
 *   const rootConcepts = await getRootConcepts();
 *   console.log(rootConcepts);
 *   // Example output:
 *   // [
 *   //   {
 *   //     subject: { value: "https://gcmd.earthdata.nasa.gov/kms/concepts/2056e9d5-1025-40c8-88c4-1ab6f62f968a" },
 *   //     prefLabel: { value: "EARTH SCIENCE" },
 *   //     scheme: { value: "science_keywords" }
 *   //   },
 *   //   {
 *   //     subject: { value: "https://gcmd.earthdata.nasa.gov/kms/concepts/5df54bf0-3b7f-4733-a62e-3cae85af402c" },
 *   //     prefLabel: { value: "AIRCRAFT" },
 *   //     scheme: { value: "platforms" }
 *   //   },
 *   //   // ... more root concepts
 *   // ]
 * } catch (error) {
 *   console.error('Failed to fetch root concepts:', error);
 * }
 */
export const getRootConceptsForAllSchemes = async () => {
  try {
    // Make a SPARQL request to get all root concepts
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getRootConceptsBySchemeQuery()
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Check if any results were returned
    if (json.results.bindings.length === 0) {
      throw new Error('No root concepts found')
    }

    // Return all root concepts
    return json.results.bindings
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error fetching root concepts:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
