import { getVersionNamesQuery } from '@/shared/operations/queries/getVersionNamesQuery'

import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches and returns an array of version names from a SPARQL endpoint.
 *
 * This function sends a SPARQL query to retrieve version names, processes the response,
 * and returns an array of version name strings.
 *
 * @async
 * @function getVersionNames
 * @returns {Promise<string[]>} A promise that resolves to an array of version name strings.
 * @throws {Error} If there's an HTTP error, no versions are found, or any other error occurs during the process.
 *
 * @example
 * // Fetching version names
 * try {
 *   const versions = await getVersionNames();
 *   console.log(versions);
 *   // Output: ['v1.0.0', 'v1.1.0', 'v2.0.0']
 * } catch (error) {
 *   console.error('Failed to fetch version names:', error);
 * }
 *
 * @example
 * // Handling errors
 * try {
 *   const versions = await getVersionNames();
 *   // Process versions...
 * } catch (error) {
 *   if (error.message === 'No versions found') {
 *     console.log('No versions are available.');
 *   } else {
 *     console.error('An error occurred:', error.message);
 *   }
 * }
 */
export const getVersionNames = async () => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getVersionNamesQuery()
    })
    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Check if any results were returned
    if (json.results.bindings.length === 0) {
      throw new Error('No versions found')
    }

    const versionObjArray = json.results.bindings

    const versionNames = versionObjArray.map((item) => item.versionName.value)

    return versionNames
  } catch (error) {
  // Log any errors that occur during the process
    console.error('Error fetching version names concepts:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
