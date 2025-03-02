// Import the query function for getting the root concept
import { getRootConceptQuery } from '@/shared/operations/queries/getRootConceptQuery'

// Import the function for making SPARQL requests
import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches the root concept for a given scheme.
 *
 * @param {string} scheme - The scheme identifier for which to fetch the root concept.
 * @returns {Promise<Object>} A promise that resolves to the root concept object.
 * @throws {Error} If there's an HTTP error, no root concept is found, or any other error occurs.
 *
 * @example
 * // Fetch the root concept for the 'science_keywords' scheme
 * try {
 *   const rootConcept = await getRootConcept('science_keywords');
 *   console.log(rootConcept);
 *   // Example output:
 *   // {
 *   //   subject: { value: "https://gcmd.earthdata.nasa.gov/kms/concepts/2056e9d5-1025-40c8-88c4-1ab6f62f968a" },
 *   //   prefLabel: { value: "EARTH SCIENCE" }
 *   // }
 * } catch (error) {
 *   console.error('Failed to fetch root concept:', error);
 * }
 *
 * @example
 * // Attempt to fetch a root concept for a non-existent scheme
 * try {
 *   const rootConcept = await getRootConcept('non_existent_scheme');
 * } catch (error) {
 *   console.error(error.message);
 *   // Expected output: "No root concept found for scheme: non_existent_scheme"
 * }
 */
export const getRootConcept = async (scheme) => {
  try {
    // Make a SPARQL request to get the root concept
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getRootConceptQuery(scheme)
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
    return json.results.bindings[0]
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error fetching root concept:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
