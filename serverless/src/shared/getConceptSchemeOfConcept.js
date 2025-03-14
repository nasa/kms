import {
  getConceptSchemeOfConceptQuery
} from '@/shared/operations/queries/getConceptSchemeOfConceptQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves the concept scheme URI for a given concept URI using a SPARQL query.
 *
 * This function queries the SPARQL endpoint for a specific version of the concept scheme
 * to find the scheme to which the given concept belongs.
 *
 * @async
 * @function getConceptSchemeOfConcept
 * @param {string} conceptUri - The URI of the concept for which to find the scheme.
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<string>} A promise that resolves to the URI of the concept scheme.
 * @throws {Error} If no scheme is found, if there's an error in the SPARQL request, or if the response is invalid.
 *
 * @example
 * // Retrieve the concept scheme for a concept in the published version
 * try {
 *   const schemeUri = await getConceptSchemeOfConcept('https://gcmd.earthdata.nasa.gov/kms/concept/1234', 'published');
 *   console.log('Concept scheme:', schemeUri);
 * } catch (error) {
 *   console.error('Error:', error.message);
 * }
 *
 * @example
 * // Retrieve the concept scheme for a concept in the draft version
 * try {
 *   const schemeUri = await getConceptSchemeOfConcept('https://gcmd.earthdata.nasa.gov/kms/concept/5678', 'draft');
 *   console.log('Concept scheme:', schemeUri);
 * } catch (error) {
 *   console.error('Error:', error.message);
 * }
 *
 * @see Related functions:
 * {@link getConceptSchemeOfConceptQuery}
 * {@link sparqlRequest}
 */
export const getConceptSchemeOfConcept = async (conceptUri, version) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeOfConceptQuery(conceptUri),
      version
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    const scheme = result.results.bindings[0]?.scheme?.value

    if (!scheme) {
      throw new Error('No scheme found for the given concept')
    }

    return scheme
  } catch (error) {
    console.error('Error fetching concept scheme:', error)
    throw error
  }
}
