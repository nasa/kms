import { getResourceValues } from '@/shared/getResourceValues'
import { getDeleteRelationshipQuery } from '@/shared/operations/queries/getDeleteRelationshipQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Ensures reciprocal relationships are properly deleted when updating or removing a concept.
 *
 * This function compares the old and new RDF/XML of a concept to identify removed relationships.
 * It then generates and executes SPARQL queries to remove the corresponding reciprocal relationships
 * from related concepts.
 *
 * @async
 * @function ensureReciprocalDeletions
 * @param {Object} params - The parameters for ensuring reciprocal deletions.
 * @param {string} params.conceptId - The ID of the concept being modified.
 * @param {string} params.oldRdfXml - The RDF/XML of the old concept version.
 * @param {string|null} params.newRdfXml - The RDF/XML of the new concept version. Null if deleting the concept.
 * @param {string} params.version - The version of the concept being modified (e.g., 'draft', 'published').
 * @param {string} params.transactionUrl - The URL of the current transaction.
 * @returns {Promise<Object>} A promise that resolves to an object with an 'ok' property set to true if successful.
 * @throws {Error} If there's an issue deleting reciprocal relationships.
 *
 * @example
 * try {
 *   await ensureReciprocalDeletions({
 *     conceptId: '123',
 *     oldRdfXml: '<rdf:RDF>...</rdf:RDF>',
 *     newRdfXml: '<rdf:RDF>...</rdf:RDF>',
 *     version: 'draft',
 *     transactionUrl: 'http://example.com/transaction/1'
 *   });
 *   console.log('Reciprocal deletions ensured successfully');
 * } catch (error) {
 *   console.error('Failed to ensure reciprocal deletions:', error);
 * }
 *
 * @see {@link getResourceValues}
 * @see {@link getDeleteRelationshipQuery}
 * @see {@link sparqlRequest}
 */
export const ensureReciprocalDeletions = async ({
  conceptId, oldRdfXml, newRdfXml, version, transactionUrl
}) => {
  const relationTypes = [
    {
      type: 'skos:broader',
      reciprocal: 'skos:narrower'
    },
    {
      type: 'skos:narrower',
      reciprocal: 'skos:broader'
    },
    {
      type: 'skos:related',
      reciprocal: 'skos:related'
    },
    {
      type: 'gcmd:hasInstrument',
      reciprocal: 'gcmd:isOnPlatform'
    },
    {
      type: 'gcmd:isOnPlatform',
      reciprocal: 'gcmd:hasInstrument'
    }
  ]

  try {
    await relationTypes.reduce(async (previousPromise, { type, reciprocal }) => {
      await previousPromise

      const oldRelatedConcepts = getResourceValues(oldRdfXml, type)
      const newRelatedConcepts = newRdfXml ? getResourceValues(newRdfXml, type) : []

      const removedRelations = oldRelatedConcepts.filter((uri) => !newRelatedConcepts.includes(uri))
      const removedUuids = removedRelations.map((uri) => uri.split('/').pop())

      if (removedUuids.length > 0) {
        const query = getDeleteRelationshipQuery({
          sourceUuid: conceptId,
          targetUuids: removedUuids,
          relationship: type,
          inverseRelationship: reciprocal
        })

        const response = await sparqlRequest({
          method: 'PUT',
          contentType: 'application/sparql-update',
          accept: 'application/sparql-results+json',
          body: query,
          version,
          transaction: {
            transactionUrl,
            action: 'UPDATE'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to delete reciprocal ${reciprocal} relationships`)
        }
      }
    }, Promise.resolve())

    return { ok: true }
  } catch (error) {
    console.error('Error deleting reciprocal relationships:', error)
    throw error
  }
}
