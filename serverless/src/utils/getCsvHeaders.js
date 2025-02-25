import { getConceptSchemeDetailsQuery } from '../operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches CSV headers for a given concept scheme
 * @param {string} scheme - The concept scheme identifier
 * @returns {Promise<string[]>} - A promise that resolves to an array of CSV headers
 */
const getCsvHeaders = async (scheme) => {
  try {
    // Make a SPARQL request to fetch concept scheme details
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeDetailsQuery(scheme)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings

    // Get the CSV headers string from the first triple
    const csvHeaderStr = triples[0]?.csvHeaders?.value
    if (csvHeaderStr) {
      // Split the CSV headers string into an array and return it
      return csvHeaderStr.split(',')
    }

    // Return an empty array if no CSV headers are found
    return []
  } catch (error) {
    // Log and re-throw any errors that occur during the process
    console.error('Error fetching triples:', error)
    throw error
  }
}

// Export the function as the default export
export default getCsvHeaders
