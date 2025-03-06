import { getConceptIdExistsQuery } from '@/shared/operations/queries/getConceptIdExistsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Checks if a concept with the given IRI exists in the SPARQL endpoint.
 *
 * This function sends a SPARQL query to check if there are any triples
 * where the given conceptIRI is the subject. If at least one triple is found,
 * the concept is considered to exist.
 *
 * @async
 * @function conceptIdExists
 * @param {string} conceptIRI - The IRI (Internationalized Resource Identifier) of the concept to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the concept exists, false otherwise.
 * @throws {Error} If there's an error in the SPARQL request or response.
 *
 * @example
 * try {
 *   const exists = await conceptIdExists('http://example.com/concept/123');
 *   console.log(exists ? 'Concept exists' : 'Concept does not exist');
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
