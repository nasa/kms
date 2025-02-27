import { getTriplesForConceptQuery } from '@/shared/operations/queries/getTriplesForConceptQuery'
import {
  getDeleteTriplesForConceptQuery
} from '@/shared/operations/updates/getDeleteTriplesForConceptQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

export const deleteTriples = async (conceptIRI) => {
  try {
    // First, select all triples
    const selectResponse = await sparqlRequest({
      type: 'query',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: getTriplesForConceptQuery(conceptIRI)
    })

    if (!selectResponse.ok) {
      throw new Error(`HTTP error! select status: ${selectResponse.status}`)
    }

    const selectData = await selectResponse.json()
    const deletedTriples = selectData.results.bindings

    // Then, delete the triples
    const deleteResponse = await sparqlRequest({
      type: 'update',
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: getDeleteTriplesForConceptQuery(conceptIRI)
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
