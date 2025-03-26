import { getModifiedDateQuery } from '@/shared/operations/queries/getModifiedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves the dcterms:modified date for a given concept from the SPARQL endpoint.
 *
 * @param {string} conceptId - The ID of the concept.
 * @param {string} version - The version of the concept (e.g., 'draft', 'published').
 * @returns {Promise<string|null>} The modified date in ISO format, or null if not found.
 */
export const getModifiedDate = async (conceptId, version) => {
  const response = await sparqlRequest({
    method: 'POST',
    path: '/query',
    body: getModifiedDateQuery(conceptId),
    accept: 'application/sparql-results+json',
    version
  })

  if (response.ok) {
    const result = await response.json()

    return result.results.bindings[0]?.modified?.value || null
  }

  return null
}
