import { getConceptSchemeDetailsQuery } from '../operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from './sparqlRequest'

const getCsvHeaders = async (scheme) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeDetailsQuery(scheme)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    const triples = json.results.bindings

    const csvHeaderStr = triples[0]?.csvHeaders?.value
    if (csvHeaderStr) {
      return csvHeaderStr.split(',')
    }

    return []
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}

export default getCsvHeaders
