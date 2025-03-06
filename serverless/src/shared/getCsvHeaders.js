/**
 * @module getCsvHeaders
 * @description Provides functionality to fetch CSV headers for a given concept scheme.
 */

import {
  getConceptSchemeDetailsQuery
} from '@/shared/operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Fetches CSV headers for a given concept scheme
 *
 * @async
 * @function getCsvHeaders
 * @param {string} scheme - The concept scheme identifier
 * @returns {Promise<string[]>} - A promise that resolves to an array of CSV headers
 * @throws {Error} If there's an HTTP error or if the SPARQL request fails
 *
 * @example
 * // Fetch CSV headers for the 'EARTH_SCIENCE' scheme
 * try {
 *   const headers = await getCsvHeaders('EARTH_SCIENCE');
 *   console.log(headers);
 *   // Output: ['Category', 'Topic', 'Term', 'Variable_Level_1', 'Variable_Level_2', 'Variable_Level_3']
 * } catch (error) {
 *   console.error('Failed to fetch CSV headers:', error);
 * }
 *
 * @example
 * // Fetch CSV headers for a non-existent scheme
 * try {
 *   const headers = await getCsvHeaders('NON_EXISTENT_SCHEME');
 *   console.log(headers);
 *   // Output: []
 * } catch (error) {
 *   console.error('Failed to fetch CSV headers:', error);
 * }
 */
export const getCsvHeaders = async (scheme, version) => {
  try {
    // Make a SPARQL request to fetch concept scheme details
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeDetailsQuery({
        scheme,
        version
      }),
      version
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings

    // Get the CSV headers string from the first triple
    const csvHeaderStr = triples[0]?.csvHeaders?.value
    if (csvHeaderStr) {
      // Split the CSV headers string into an array and return it
      return csvHeaderStr.split(',')
    }

    // Return an empty array if no CSV headers are found
    return []
  } catch (error) {
    // Log and re-throw any errors that occur during the process
    console.error('Error fetching triples:', error)
    throw error
  }
}
