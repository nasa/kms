import { sparqlRequest } from './sparqlRequest'

const getLongNamesMap = async (scheme) => {
  const sparqlQuery = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    SELECT ?subject ?bp ?bo
    WHERE {
      ?subject skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .
      ?subject gcmd:altLabel ?blankNode .
      ?blankNode ?bp ?bo
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

    const triples = json.results.bindings

    const map = {}

    triples.forEach((triple) => {
      if (!map[triple.subject.value]) {
        map[triple.subject.value] = []
      }

      if (triple.bo.value !== 'primary') {
        map[triple.subject.value].push(triple.bo.value)
      }
    })

    return map
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}

export default getLongNamesMap
