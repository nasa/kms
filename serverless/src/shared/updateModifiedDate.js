import { getUpdateModifiedDateQuery } from '@/shared/operations/updates/getUpdateModifiedDateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Updates the dcterms:modified date for a given concept in the SPARQL endpoint.
 *
 * @async
 * @function updateModifiedDate
 * @param {string} conceptId - The ID of the concept to update.
 * @param {string} version - The version of the concept (e.g., 'draft', 'published').
 * @param {string} date - The new date in ISO format (YYYY-MM-DD).
 * @param {string} transactionUrl - The URL for the SPARQL transaction.
 * @returns {Promise<boolean>} A promise that resolves to true if the update was successful, false otherwise.
 * @throws {Error} If there's an error during the SPARQL update operation.
 *
 * @example
 * try {
 *   const success = await updateModifiedDate(
 *     'concept123',
 *     'draft',
 *     '2023-06-15',
 *     'http://example.com/sparql/transaction'
 *   );
 *   if (success) {
 *     console.log('Modified date updated successfully');
 *   } else {
 *     console.log('Failed to update modified date');
 *   }
 * } catch (error) {
 *   console.error('Error updating modified date:', error);
 * }
 *
 * @see Related functions:
 * {@link getUpdateModifiedDateQuery}
 * {@link sparqlRequest}
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
