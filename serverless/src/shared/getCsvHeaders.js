/**
 * @module getCsvHeaders
 * @description Provides functionality to fetch CSV headers for a given concept scheme and version.
 */

import {
  getConceptSchemeDetailsQuery
} from '@/shared/operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Fetches CSV headers for a given concept scheme and version
 *
 * @async
 * @function getCsvHeaders
 * @param {string} scheme - The concept scheme identifier
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number)
 * @returns {Promise<string[]>} - A promise that resolves to an array of CSV headers
 * @throws {Error} If there's an HTTP error or if the SPARQL request fails
 *
 * @example
 * // Fetch CSV headers for the 'EARTH_SCIENCE' scheme in the published version
 * try {
 *   const headers = await getCsvHeaders('EARTH_SCIENCE', 'published');
 *   console.log(headers);
 *   // Output: ['Category', 'Topic', 'Term', 'Variable_Level_1', 'Variable_Level_2', 'Variable_Level_3']
 * } catch (error) {
 *   console.error('Failed to fetch CSV headers:', error);
 * }
 *
 * @example
 * // Fetch CSV headers for the 'INSTRUMENTS' scheme in the draft version
 * try {
 *   const headers = await getCsvHeaders('INSTRUMENTS', 'draft');
 *   console.log(headers);
 *   // Output: ['Category', 'Class', 'Type', 'Subtype', 'Short_Name']
 * } catch (error) {
 *   console.error('Failed to fetch CSV headers:', error);
 * }
 *
 * @example
 * // Fetch CSV headers for a non-existent scheme
 * try {
 *   const headers = await getCsvHeaders('NON_EXISTENT_SCHEME', 'published');
 *   console.log(headers);
 *   // Output: []
 * } catch (error) {
 *   console.error('Failed to fetch CSV headers:', error);
 * }
 *
 * @see Related functions:
 * {@link getConceptSchemeDetailsQuery}
 * {@link sparqlRequest}
 */
export const getCsvHeaders = async (scheme, version) => {
  try {
    // Make a SPARQL request to fetch concept scheme details
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeDetailsQuery(scheme),
      version,
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '30000', 10)
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
