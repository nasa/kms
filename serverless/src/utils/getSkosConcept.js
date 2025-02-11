import { sparqlRequest } from './sparqlRequest'
import toSkosJson from './toSkosJson'

/**
 * Retrieves a SKOS concept from the RDF database given the specified uri identifier.
 * @param {String} uri the URI of the SKOS concept
 * @returns the SKOS concept represented as JSON.
 */
const getSkosConcept = async (conceptIRI) => {
  const sparqlQuery = `
  SELECT ?s ?p ?o
  WHERE {
    {
      <${conceptIRI}> ?p ?o .
      BIND(<${conceptIRI}> AS ?s)
    } UNION {
      <${conceptIRI}> ?p ?s .
      ?s ?p ?o .
      FILTER(isBlank(?s))
    }
  }
`
  try {
    const response = await sparqlRequest({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: sparqlQuery
    })

    if (!response.ok) {
      console.log('response=', await response.text())
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    if (json.results.bindings.length === 0) {
      throw new Error(`No results found for concept: ${conceptIRI}`)
    }

    return toSkosJson(conceptIRI, json.results.bindings)
  } catch (error) {
    console.error('Error fetching SKOS concept:', error)
    throw error
  }
}

export default getSkosConcept
