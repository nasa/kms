import { getUpdateCreatedDateQuery } from '@/shared/operations/updates/getUpdateCreatedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Updates the dcterms:created date for a given concept in the SPARQL endpoint.
 *
 * @param {string} conceptId - The ID of the concept.
 * @param {string} version - The version of the concept (e.g., 'draft', 'published').
 * @param {string} date - The new date in ISO format (YYYY-MM-DD).
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
export const updateCreatedDate = async (conceptId, version, date) => {
  const response = await sparqlRequest({
    method: 'POST',
    body: getUpdateCreatedDateQuery(conceptId, date),
    contentType: 'application/sparql-update',
    accept: 'application/sparql-results+json',
    version
  })

  return response.ok
}
