import { getLongNamesQuery } from '../operations/queries/getLongNamesQuery'
import { sparqlRequest } from './sparqlRequest'

const getLongNamesMap = async (scheme) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getLongNamesQuery(scheme)
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
