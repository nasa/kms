import { getConceptIdExistsQuery } from '@/shared/operations/queries/getConceptIdExistsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Checks if a concept with the given IRI exists in the SPARQL endpoint for a specific version.
 *
 * This function sends a SPARQL query to check if there are any triples
 * where the given conceptIRI is the subject in the specified version of the concept scheme.
 * If at least one triple is found, the concept is considered to exist.
 *
 * @async
 * @function conceptIdExists
 * @param {string} conceptIRI - The IRI (Internationalized Resource Identifier) of the concept to check.
 * @param {string} version - The version of the concept scheme to check against (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<boolean>} A promise that resolves to true if the concept exists in the specified version, false otherwise.
 * @throws {Error} If there's an error in the SPARQL request or response.
 *
 * @example
 * // Check if a concept exists in the published version
 * try {
 *   const exists = await conceptIdExists('http://example.com/concept/123', 'published');
 *   console.log(exists ? 'Concept exists in published version' : 'Concept does not exist in published version');
 * } catch (error) {
 *   console.error('Error checking concept existence:', error);
 * }
 *
 * @example
 * // Check if a concept exists in the draft version
 * try {
 *   const exists = await conceptIdExists('http://example.com/concept/123', 'draft');
 *   console.log(exists ? 'Concept exists in draft version' : 'Concept does not exist in draft version');
 * } catch (error) {
 *   console.error('Error checking concept existence:', error);
 * }
 *
 * @example
 * // Check if a concept exists in a specific version
 * try {
 *   const exists = await conceptIdExists('http://example.com/concept/123', '9.1.5');
 *   console.log(exists ? 'Concept exists in version 9.1.5' : 'Concept does not exist in version 9.1.5');
 * } catch (error) {
 *   console.error('Error checking concept existence:', error);
 * }
 */
export const conceptIdExists = async (conceptIRI, version) => {
  const checkResponse = await sparqlRequest({
    contentType: 'application/sparql-query',
    accept: 'application/sparql-results+json',
    method: 'POST',
    body: getConceptIdExistsQuery(conceptIRI),
    version
  })

  if (!checkResponse.ok) {
    const errorText = await checkResponse.text()
    throw new Error(`Error checking concept existence: ${checkResponse.status}. ${errorText}`)
  }

  const checkResult = await checkResponse.json()

  return checkResult.results.bindings.length > 0
}
