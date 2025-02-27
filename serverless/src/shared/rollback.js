import { getInsertTriplesQuery } from '@/shared/operations/updates/getInsertTriplesQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Performs a rollback operation by reinserting deleted triples into the RDF store.
 *
 * This function is used as part of a transaction-like process in updating RDF concepts.
 * If an update operation fails after deleting existing triples, this rollback function
 * is called to reinsert the deleted triples, effectively undoing the deletion.
 *
 * @async
 * @param {Array} deletedTriples - An array of triple objects, each containing s (subject),
 *                                 p (predicate), and o (object) properties with their respective values.
 * @throws {Error} Throws an error if the rollback operation fails.
 *
 * The function constructs a SPARQL INSERT DATA query from the deleted triples and
 * sends it to the RDF store using the sparqlRequest utility. If the request is not
 * successful (i.e., non-OK response), it throws an error. Any error during the process
 * is logged and re-thrown for handling by the caller.
 */
export const rollback = async (deletedTriples) => {
  try {
    const rollbackResponse = await sparqlRequest({
      type: 'query',
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: getInsertTriplesQuery(deletedTriples)
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
