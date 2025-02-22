import { getTriplesForConceptQuery } from '../operations/queries/getTriplesForConceptQuery'
import {
  getDeleteTriplesForConceptQuery
} from '../operations/updates/getDeleteTriplesForConceptQuery'
import { sparqlRequest } from './sparqlRequest'

async function deleteTriples(conceptIRI) {
  try {
    // First, select all triples
    const selectResponse = await sparqlRequest({
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
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      path: '/statements',
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

export default deleteTriples
