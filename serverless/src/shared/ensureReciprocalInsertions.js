import { getResourceValues } from '@/shared/getResourceValues'
import { getCreateRelationshipQuery } from '@/shared/operations/queries/getCreateRelationshipQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Ensures reciprocal relations are created for a given concept.
 *
 * This function takes an RDF/XML representation of a concept and creates reciprocal
 * relationships for specified relation types. It checks for existing relation types
 * in the RDF/XML and creates the corresponding reciprocal relationships.
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} params.rdfXml - The RDF/XML representation of the concept.
 * @param {string} params.conceptId - The UUID of the concept.
 * @param {string} params.version - The version of the concept.
 * @param {string} params.transactionUrl - The URL for the transaction.
 * @returns {Promise<Object>} A promise that resolves to { ok: true } if successful.
 * @throws {Error} If there's an error creating reciprocal relationships.
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
 *   const result = await ensureReciprocalRelations({
 *     rdfXml,
 *     conceptId: '043dc242-1014-4e9a-91ee-c472b791b026',
 *     version: '1',
 *     transactionUrl: 'http://example.com/transaction'
 *   });
 *   console.log(result); // { ok: true }
 * } catch (error) {
 *   console.error('Error:', error);
 * }
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
    },
    {
      type: 'gcmd:hasSensor',
      reciprocal: 'gcmd:isOnPlatform'
    }
  ]

  try {
    // Filter relation types to only those that exist in the rdfXml
    const existingRelationTypes = relationTypes.filter(({ type }) => {
      try {
        const values = getResourceValues(rdfXml, type)

        return values && values.length > 0
      } catch (error) {
        console.warn(`Error checking for relation type ${type}:`, error)

        return false
      }
    })
    await existingRelationTypes.reduce(async (previousPromise, { type, reciprocal }) => {
      await previousPromise

      const relatedConcepts = getResourceValues(rdfXml, type)
      const targetUuids = relatedConcepts.map((uri) => uri.split('/').pop())

      const query = getCreateRelationshipQuery({
        sourceUuid: conceptId,
        targetUuids,
        relationship: type,
        inverseRelationship: reciprocal
      })
      console.log('insertion query=', query)

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
