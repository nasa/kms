import {
  getConceptSchemeDetailsQuery
} from '@/shared/operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves details for concept schemes from a specified version of the SPARQL endpoint.
 *
 * This function fetches information about one or all concept schemes, including their URI,
 * preferred label, notation, modification date, and CSV headers (if available).
 *
 * @async
 * @function getConceptSchemeDetails
 * @param {Object} params - The parameters for the query.
 * @param {string} [params.schemeName=null] - The name of the concept scheme (e.g., "ChainedOperations"). If not provided, returns all concept schemes.
 * @param {string} params.version - The version of the concept schemes to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Object|Array<Object>|null>} A promise that resolves to:
 *   - An object containing details of a single scheme (if schemeName is provided)
 *   - An array of objects containing details of all schemes (if schemeName is not provided)
 *   - null if no results are found
 * @throws {Error} If there's an error during the SPARQL request or processing the response.
 *
 * @example
 * // Fetch details for all concept schemes in the published version
 * try {
 *   const allSchemes = await getConceptSchemeDetails({ version: 'published' });
 *   console.log('All schemes:', allSchemes);
 * } catch (error) {
 *   console.error('Error fetching all schemes:', error);
 * }
 *
 * @example
 * // Fetch details for a specific concept scheme in the draft version
 * try {
 *   const schemeDetails = await getConceptSchemeDetails({ schemeName: 'ChainedOperations', version: 'draft' });
 *   console.log('Scheme details:', schemeDetails);
 * } catch (error) {
 *   console.error('Error fetching scheme details:', error);
 * }
 *
 * @see Related functions:
 * {@link getConceptSchemeDetailsQuery}
 * {@link sparqlRequest}
 */
export const getConceptSchemeDetails = async ({
  schemeName = null, version
}) => {
  try {
    const query = getConceptSchemeDetailsQuery(schemeName)

    const response = await sparqlRequest({
      method: 'POST',
      body: query,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (result.results.bindings.length === 0) {
      return null // No results found
    }

    const processBinding = (binding) => ({
      uri: binding.scheme.value,
      prefLabel: binding.prefLabel.value,
      notation: binding.notation.value,
      modified: binding.modified.value,
      csvHeaders: binding.csvHeaders ? binding.csvHeaders.value : null
    })

    if (schemeName) {
      // Return a single object if a specific scheme was requested
      return processBinding(result.results.bindings[0])
    }

    // Return an array of all concept schemes
    return result.results.bindings.map(processBinding)
  } catch (error) {
    console.error('Error fetching concept scheme details:', error)
    throw error
  }
}
