import { getConceptChangeNotesQuery } from './operations/queries/getConceptChangeNotesQuery'
import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches concept change notes based on provided parameters.
 *
 * @async
 * @function getConceptChangeNoteTriples
 * @param {Object} params - The parameters for fetching concept change notes.
 * @param {string} params.version - The version of the API to use.
 * @param {string} [params.scheme] - The scheme to filter the concepts by (optional).
 * @returns {Promise<Array>} A promise that resolves to an array of concept change notes.
 * @throws {Error} Throws an error if the request fails or no results are found.
 *
 * @example
 * // Fetch concept change notes for a specific date range and scheme
 * try {
 *   const notes = await getConceptChangeNoteTriples({
 *     version: 'v1',
 *     scheme: 'earth_science'
 *   });
 *   console.log(notes);
 * } catch (error) {
 *   console.error('Failed to fetch concept change notes:', error);
 * }
 *
 * @example
 * // Fetch all concept change notes without date range or scheme
 * try {
 *   const allNotes = await getConceptChangeNoteTriples({
 *     version: 'v1'
 *   });
 *   console.log(allNotes);
 * } catch (error) {
 *   console.error('Failed to fetch all concept change notes:', error);
 * }
 */
export const getConceptChangeNoteTriples = async ({
  version, scheme
}) => {
  const query = getConceptChangeNotesQuery(
    scheme ? `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}` : null
  )

  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: query,
      version
    })
    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Check if any results were returned
    if (json.results.bindings.length === 0) {
      throw new Error('No concept change notes found')
    }

    return json.results.bindings
  } catch (error) {
  // Log any errors that occur during the process
    console.error('Error fetching concept change notes:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
