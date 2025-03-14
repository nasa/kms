import { getTriplesForConceptQuery } from '@/shared/operations/queries/getTriplesForConceptQuery'
import {
  getDeleteTriplesForConceptQuery
} from '@/shared/operations/updates/getDeleteTriplesForConceptQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Deletes all triples associated with a given concept from the SPARQL endpoint.
 *
 * This function performs a two-step process:
 * 1. It first selects all triples related to the given concept.
 * 2. Then it deletes these triples from the specified version of the graph.
 *
 * @async
 * @function deleteTriples
 * @param {string} conceptIRI - The IRI (Internationalized Resource Identifier) of the concept to delete.
 * @param {string} version - The version of the graph to delete from (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   @property {Array} deletedTriples - An array of triples that were deleted.
 *   @property {Object} deleteResponse - The response object from the delete operation.
 * @throws {Error} If there's an error during the SPARQL select or delete operations.
 *
 * @example
 * // Delete triples for a concept in the published version
 * try {
 *   const result = await deleteTriples('http://example.com/concept/123', 'published');
 *   console.log(`Deleted ${result.deletedTriples.length} triples`);
 * } catch (error) {
 *   console.error('Error deleting triples:', error);
 * }
 *
 * @example
 * // Delete triples for a concept in the draft version
 * try {
 *   const result = await deleteTriples('http://example.com/concept/456', 'draft');
 *   console.log(`Deleted ${result.deletedTriples.length} triples`);
 * } catch (error) {
 *   console.error('Error deleting triples:', error);
 * }
 *
 * @see Related functions:
 * {@link getTriplesForConceptQuery}
 * {@link getDeleteTriplesForConceptQuery}
 * {@link sparqlRequest}
 */
export const deleteTriples = async (conceptIRI, version) => {
  try {
    // First, select all triples
    const selectResponse = await sparqlRequest({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: getTriplesForConceptQuery(conceptIRI),
      version
    })

    if (!selectResponse.ok) {
      throw new Error(`HTTP error! select status: ${selectResponse.status}`)
    }

    const selectData = await selectResponse.json()
    const deletedTriples = selectData.results.bindings

    // Then, delete the triples
    const deleteResponse = await sparqlRequest({
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      path: '/statements',
      method: 'POST',
      body: getDeleteTriplesForConceptQuery(conceptIRI),
      version
    })

    if (!deleteResponse.ok) {
      throw new Error(`HTTP error! delete status: ${deleteResponse.status}`)
    }

    return {
      deletedTriples,
      deleteResponse
    }
  } catch (error) {
    console.error('Error deleting concept:', error)
    throw error
  }
}
