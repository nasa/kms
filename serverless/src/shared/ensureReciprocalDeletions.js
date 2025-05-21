import { getResourceValues } from '@/shared/getResourceValues'
import { getDeleteRelationshipQuery } from '@/shared/operations/queries/getDeleteRelationshipQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

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
    },
    {
      type: 'gcmd:hasSensor',
      reciprocal: 'gcmd:isOnPlatform'
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

        console.log('deletion query=', query)

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
