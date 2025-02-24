import {
  getConceptSchemeOfConceptQuery
} from '@/shared/operations/queries/getConceptSchemeOfConceptQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves the concept scheme URI for a given concept URI using a SPARQL query.
 *
 * @param {string} conceptUri - The URI of the concept for which to find the scheme.
 * @returns {Promise<string>} A promise that resolves to the URI of the concept scheme.
 * @throws {Error} If no scheme is found or if there's an error in the SPARQL request.
 *
 * @example
 * // Usage
 * try {
 *   const schemeUri = await getConceptScheme('https://gcmd.earthdata.nasa.gov/kms/concept/1234');
 *   console.log('Concept scheme:', schemeUri);
 * } catch (error) {
 *   console.error('Error:', error.message);
 * }
 */
export const getConceptSchemeOfConcept = async (conceptUri) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeOfConceptQuery(conceptUri)
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
