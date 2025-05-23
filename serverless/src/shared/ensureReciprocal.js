import { ensureReciprocalDeletions } from '@/shared/ensureReciprocalDeletions'
import { ensureReciprocalInsertions } from '@/shared/ensureReciprocalInsertions'

/**
 * Ensures reciprocal relationships are maintained when updating or deleting a concept.
 *
 * This function handles both the deletion of old reciprocal relationships and the
 * insertion of new ones. It's designed to work within a transaction to maintain
 * data consistency.
 *
 * @async
 * @function ensureReciprocal
 * @param {Object} params - The parameters for ensuring reciprocal relationships.
 * @param {string|null} params.oldRdfXml - The RDF/XML of the old concept version. Null if creating a new concept.
 * @param {string|null} params.newRdfXml - The RDF/XML of the new concept version. Null if deleting a concept.
 * @param {string} params.conceptId - The ID of the concept being modified.
 * @param {string} params.version - The version of the concept being modified (e.g., 'draft', 'published').
 * @param {string} params.transactionUrl - The URL of the current transaction.
 * @returns {Promise<Object>} A promise that resolves to an object with an 'ok' property set to true if successful.
 * @throws {Error} If there's an issue ensuring reciprocal relationships.
 *
 * @example
 * try {
 *   await ensureReciprocal({
 *     oldRdfXml: '<rdf:RDF>...</rdf:RDF>',
 *     newRdfXml: '<rdf:RDF>...</rdf:RDF>',
 *     conceptId: '123',
 *     version: 'draft',
 *     transactionUrl: 'http://example.com/transaction/1'
 *   });
 *   console.log('Reciprocal relationships ensured successfully');
 * } catch (error) {
 *   console.error('Failed to ensure reciprocal relationships:', error);
 * }
 *
 * @see {@link ensureReciprocalDeletions}
 * @see {@link ensureReciprocalInsertions}
 */
export const ensureReciprocal = async ({
  oldRdfXml,
  newRdfXml,
  conceptId,
  version,
  transactionUrl
}) => {
  try {
    // Handle deletions
    if (oldRdfXml) {
      await ensureReciprocalDeletions({
        conceptId,
        oldRdfXml,
        newRdfXml,
        version,
        transactionUrl
      })
    }

    // Handle insertions only if newRdfXml is provided (i.e., not a deletion)
    if (newRdfXml) {
      await ensureReciprocalInsertions({
        rdfXml: newRdfXml,
        conceptId,
        version,
        transactionUrl
      })
    }

    return { ok: true }
  } catch (error) {
    console.error('Error ensuring reciprocal relationships:', error)
    throw error
  }
}
