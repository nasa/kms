import {
  getDeleteTriplesForConceptQuery
} from '@/shared/operations/updates/getDeleteTriplesForConceptQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Deletes all triples associated with a given concept from the SPARQL endpoint.
 *
 * This function performs a delete operation for all triples related to the given concept
 * in the specified version of the graph.
 *
 * @async
 * @function deleteTriples
 * @param {string} conceptIRI - The IRI (Internationalized Resource Identifier) of the concept to delete.
 * @param {string} version - The version of the graph to delete from (e.g., 'published', 'draft', or a specific version number).
 * @param {string} transactionUrl - The URL for the SPARQL transaction.
 * @returns {Promise<Object>} A promise that resolves to the response object from the delete operation.
 * @throws {Error} If there's an error during the SPARQL delete operation.
 *
 * @example
 * // Delete triples for a concept in the published version
 * try {
 *   const result = await deleteTriples(
 *     'http://example.com/concept/123',
 *     'published',
 *     'http://example.com/sparql/transaction'
 *   );
 *   console.log('Delete operation completed successfully');
 * } catch (error) {
 *   console.error('Error deleting triples:', error);
 * }
 *
 * @example
 * // Delete triples for a concept in the draft version
 * try {
 *   const result = await deleteTriples(
 *     'http://example.com/concept/456',
 *     'draft',
 *     'http://example.com/sparql/transaction'
 *   );
 *   console.log('Delete operation completed successfully');
 * } catch (error) {
 *   console.error('Error deleting triples:', error);
 * }
 *
 * @see Related functions:
 * {@link getDeleteTriplesForConceptQuery}
 * {@link sparqlRequest}
 */
export const deleteTriples = async (conceptIRI, version, transactionUrl) => {
  try {
    const deleteResponse = await sparqlRequest({
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      path: '/statements',
      method: transactionUrl ? 'PUT' : 'POST',
      body: getDeleteTriplesForConceptQuery(conceptIRI),
      version,
      transaction: {
        transactionUrl,
        action: 'UPDATE'
      }
    })

    if (!deleteResponse.ok) {
      throw new Error(`HTTP error! delete status: ${deleteResponse.status}`)
    }

    return deleteResponse
  } catch (error) {
    console.error('Error deleting concept:', error)
    throw error
  }
}
