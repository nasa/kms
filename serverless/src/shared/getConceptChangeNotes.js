import { getConceptChangeNotesQuery } from './operations/queries/getConceptChangeNotesQuery'
import { sparqlRequest } from './sparqlRequest'

export const getConceptChangeNotes = async ({
  version, scheme, startDate, endDate
}) => {
  const query = getConceptChangeNotesQuery({
    startDate,
    endDate,
    scheme: scheme ? `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}` : null
  })

  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: query,
      version
    })
    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Check if any results were returned
    // if (json.results.bindings.length === 0) {
    //   throw new Error('No concept change notes found')
    // }

    console.log('triples=', json.results.bindings)
  } catch (error) {
  // Log any errors that occur during the process
    console.error('Error fetching root concepts:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
