import { getResourceValues } from '@/shared/getResourceValues'
import { getCreateRelationshipQuery } from '@/shared/operations/queries/getCreateRelationshipQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Ensures reciprocal relationships are properly created when adding or updating a concept.
 *
 * This function analyzes the RDF/XML of a concept to identify relationships that require
 * reciprocal entries. It then generates and executes SPARQL queries to create the
 * corresponding reciprocal relationships in related concepts.
 *
 * @async
 * @function ensureReciprocalInsertions
 * @param {Object} params - The parameters for ensuring reciprocal insertions.
 * @param {string} params.rdfXml - The RDF/XML representation of the concept.
 * @param {string} params.conceptId - The UUID of the concept being modified.
 * @param {string} params.version - The version of the concept being modified (e.g., 'draft', 'published').
 * @param {string} params.transactionUrl - The URL of the current transaction.
 * @returns {Promise<Object>} A promise that resolves to an object with an 'ok' property set to true if successful.
 * @throws {Error} If there's an issue creating reciprocal relationships.
 *
 * @example
 * const rdfXml = `
 *   <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
 *     <skos:Concept rdf:about="043dc242-1014-4e9a-91ee-c472b791b026">
 *       <skos:broader rdf:resource="bc24693a-c946-4704-8475-9688ce2f4a13"/>
 *     </skos:Concept>
 *   </rdf:RDF>
 * `;
 *
 * try {
 *   const result = await ensureReciprocalInsertions({
 *     rdfXml,
 *     conceptId: '043dc242-1014-4e9a-91ee-c472b791b026',
 *     version: 'draft',
 *     transactionUrl: 'http://example.com/transaction/1'
 *   });
 *   console.log('Reciprocal insertions ensured successfully');
 * } catch (error) {
 *   console.error('Failed to ensure reciprocal insertions:', error);
 * }
 *
 * @see {@link getResourceValues}
 * @see {@link getCreateRelationshipQuery}
 * @see {@link sparqlRequest}
 */
export const ensureReciprocalInsertions = async ({
  rdfXml, conceptId, version, transactionUrl
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
    // Filter relation types to only those that exist in the rdfXml
    const existingRelationTypes = relationTypes.filter(({ type }) => {
      const values = getResourceValues(rdfXml, type)

      return values && values.length > 0
    })
    await existingRelationTypes.reduce(async (previousPromise, { type, reciprocal }) => {
      await previousPromise

      const relatedConcepts = getResourceValues(rdfXml, type)

      if (!relatedConcepts || relatedConcepts.length === 0) {
        return undefined
      }

      const targetUuids = relatedConcepts.map((uri) => uri.split('/').pop())

      const query = getCreateRelationshipQuery({
        sourceUuid: conceptId,
        targetUuids,
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
        throw new Error(`Failed to create reciprocal ${reciprocal} relationships`)
      }

      return undefined
    }, Promise.resolve())

    return { ok: true }
  } catch (error) {
    console.error('Error creating reciprocal relationships:', error)
    throw error
  }
}
