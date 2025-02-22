import { getNarrowerConceptsQuery } from '../operations/queries/getNarrowerConceptsQuery'
import { sparqlRequest } from './sparqlRequest'

const getNarrowersMap = async (scheme) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getNarrowerConceptsQuery(scheme)
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

      map[triple.subject.value].push(triple)
    })

    return map
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}

export default getNarrowersMap
