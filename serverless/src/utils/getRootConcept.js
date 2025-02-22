import { sparqlRequest } from './sparqlRequest'

const getRootConcept = async (scheme) => {
  const sparqlQuery = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?subject ?prefLabel
    WHERE {
      ?subject skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .
      ?subject skos:prefLabel ?prefLabel
      FILTER NOT EXISTS {
        ?subject skos:broader ?broaderConcept .
      }
    }
  `
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: sparqlQuery
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    if (json.results.bindings.length === 0) {
      throw new Error(`No root concept found for scheme: ${scheme}`)
    }

    return json.results.bindings[0]
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}

export default getRootConcept
