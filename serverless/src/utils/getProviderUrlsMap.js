import { getProviderUrlsQuery } from '../operations/queries/getProviderUrlsQuery'
import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches provider URLs and creates a map based on the given scheme.
 * @param {string} scheme - The scheme to use for the query.
 * @returns {Object} A map of subject values to their corresponding business object values.
 */
const getProviderUrlsMap = async (scheme) => {
  try {
    // Make a SPARQL request to fetch provider URLs
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getProviderUrlsQuery(scheme)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings

    // Initialize an empty map to store the results
    const map = {}

    // Iterate through each triple
    triples.forEach((triple) => {
      // If the subject is not in the map, initialize it with an empty array
      if (!map[triple.subject.value]) {
        map[triple.subject.value] = []
      }

      // Add the business object value to the subject's array,
      // unless it's 'provider' (case-insensitive)
      if (triple.bo.value.toLowerCase() !== 'provider') {
        map[triple.subject.value].push(triple.bo.value)
      }
    })

    return map
  } catch (error) {
    // Log and re-throw any errors that occur
    console.error('Error fetching triples:', error)
    throw error
  }
}

export default getProviderUrlsMap
