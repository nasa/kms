import { getInsertTriplesQuery } from '@/shared/operations/updates/getInsertTriplesQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Performs a rollback operation by reinserting deleted triples into a specific version of the RDF store.
 *
 * This function is used as part of a transaction-like process in updating RDF concepts.
 * If an update operation fails after deleting existing triples, this rollback function
 * is called to reinsert the deleted triples, effectively undoing the deletion for the specified version.
 *
 * @async
 * @function rollback
 * @param {Array} deletedTriples - An array of triple objects, each containing s (subject),
 *                                 p (predicate), and o (object) properties with their respective values.
 * @param {string} version - The version of the RDF store to rollback (e.g., 'published', 'draft', or a specific version number).
 * @throws {Error} Throws an error if the rollback operation fails.
 *
 * @example
 * // Rollback deleted triples in the published version
 * try {
 *   const deletedTriples = [
 *     { s: { value: 'http://example.com/concept/123' }, p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' }, o: { value: 'Old Label' } }
 *   ];
 *   await rollback(deletedTriples, 'published');
 *   console.log('Rollback successful');
 * } catch (error) {
 *   console.error('Rollback failed:', error);
 * }
 *
 * @example
 * // Rollback deleted triples in the draft version
 * try {
 *   const deletedTriples = [
 *     { s: { value: 'http://example.com/concept/456' }, p: { value: 'http://www.w3.org/2004/02/skos/core#definition' }, o: { value: 'Old definition' } }
 *   ];
 *   await rollback(deletedTriples, 'draft');
 *   console.log('Rollback successful');
 * } catch (error) {
 *   console.error('Rollback failed:', error);
 * }
 *
 * The function constructs a SPARQL INSERT DATA query from the deleted triples and
 * sends it to the specified version of the RDF store using the sparqlRequest utility.
 * If the request is not successful (i.e., non-OK response), it throws an error.
 * Any error during the process is logged and re-thrown for handling by the caller.
 *
 * @see Related functions:
 * {@link getInsertTriplesQuery}
 * {@link sparqlRequest}
 */
export const rollback = async (deletedTriples, version) => {
  try {
    const rollbackResponse = await sparqlRequest({
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      path: '/statements',
      method: 'POST',
      body: getInsertTriplesQuery(deletedTriples),
      version
    })

    if (!rollbackResponse.ok) {
      throw new Error(`Rollback failed! status: ${rollbackResponse.status}`)
    }

    console.log('Rollback successful')
  } catch (rollbackError) {
    console.error('Rollback failed:', rollbackError)
    throw rollbackError
  }
}
