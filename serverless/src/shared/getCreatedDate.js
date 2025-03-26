import { getCreateDateQuery } from '@/shared/operations/queries/getCreatedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves the dcterms:created date for a given concept from the SPARQL endpoint.
 *
 * @param {string} conceptId - The ID of the concept.
 * @param {string} version - The version of the concept (e.g., 'draft', 'published').
 * @returns {Promise<string|null>} The created date in ISO format, or null if not found.
 */
export const getCreatedDate = async (conceptId, version) => {
  const response = await sparqlRequest({
    method: 'POST',
    path: '/query',
    body: getCreateDateQuery(conceptId),
    accept: 'application/sparql-results+json',
    version
  })

  if (response.ok) {
    const result = await response.json()

    return result.results.bindings[0]?.created?.value || null
  }

  return null
}
