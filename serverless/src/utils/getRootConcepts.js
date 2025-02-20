import { sparqlRequest } from './sparqlRequest'

/**
 * Retrieves all triples for root SKOS concepts (concepts without a broader concept).
 *
 * @async
 * @function getRootConcepts
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects for root concepts.
 * @throws {Error} If there's an error during the SPARQL request or processing of the response.
 */
const getRootConcepts = async () => {
  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT DISTINCT ?s ?p ?o
    WHERE {
      {
        ?s rdf:type skos:Concept .
        FILTER NOT EXISTS { ?s skos:broader ?broader }
        ?s ?p ?o .
      }
      UNION
      {
        ?s rdf:type skos:Concept .
        FILTER NOT EXISTS { ?s skos:broader ?broader }
        ?s ?p1 ?o1 .
        ?o1 ?p ?o .
        FILTER(isBlank(?o1))
      }
    }
  `

  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: query
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    return result.results.bindings
  } catch (error) {
    console.error('Error fetching root concepts:', error)
    throw error
  }
}

export default getRootConcepts
