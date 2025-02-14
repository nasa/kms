// Serverless/src/utils/deleteTriples.js
import { sparqlRequest } from './sparqlRequest'

async function deleteTriples(conceptIRI) {
  const selectQuery = `
    SELECT ?s ?p ?o
    WHERE {
      ?s ?p ?o .
      FILTER(?s = <${conceptIRI}>)
    }
  `

  const deleteQuery = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    DELETE {
      ?s ?p ?o .
    }
    WHERE {
      ?s ?p ?o .
      FILTER(?s = <${conceptIRI}>)
    }
  `

  try {
    // First, select all triples
    const selectResponse = await sparqlRequest({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: selectQuery
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
      body: deleteQuery
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
