import { sparqlRequest } from './sparqlRequest'

/**
 * Deletes all triples and blank nodes from the SPARQL endpoint.
 * WARNING: This will remove ALL data from your triplestore.
 * Use with extreme caution and ensure you have proper backups.
 *
 * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful.
 * @throws Will throw an error if the DELETE operation fails.
 */
const deleteAllTriples = async () => {
  const deleteQuery = `
    DELETE {
      ?s ?p ?o
    }
    WHERE {
      ?s ?p ?o
    }
  `

  return sparqlRequest({
    path: '/statements',
    method: 'POST',
    contentType: 'application/sparql-update',
    body: deleteQuery
  })
}

export default deleteAllTriples
