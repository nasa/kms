import { getUpdateModifiedDateQuery } from '@/shared/operations/updates/getUpdateModifiedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Updates the dcterms:modified date for a given concept in the SPARQL endpoint.
 *
 * @param {string} conceptId - The ID of the concept.
 * @param {string} version - The version of the concept (e.g., 'draft', 'published').
 * @param {string} date - The new date in ISO format (YYYY-MM-DD).
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
export const updateModifiedDate = async (conceptId, version, date, transactionUrl) => {
  const response = await sparqlRequest({
    method: 'PUT',
    body: getUpdateModifiedDateQuery(conceptId, date),
    contentType: 'application/sparql-update',
    version,
    transaction: {
      transactionUrl,
      action: 'UPDATE'
    }
  })

  return response.ok
}
