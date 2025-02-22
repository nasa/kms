import { getProviderUrlsQuery } from '../operations/queries/getProviderUrlsQuery'
import { sparqlRequest } from './sparqlRequest'

const getProviderUrlsMap = async (scheme) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getProviderUrlsQuery(scheme)
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

      if (triple.bo.value.toLowerCase() !== 'provider') {
        map[triple.subject.value].push(triple.bo.value)
      }
    })

    return map
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}

export default getProviderUrlsMap
