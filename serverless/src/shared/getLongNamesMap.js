// Import necessary functions and modules
import { getLongNamesQuery } from '@/shared/operations/queries/getLongNamesQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Fetches long names for a given scheme and returns them as a map
 * @param {string} scheme - The scheme to fetch long names for
 * @returns {Promise<Object>} A map of subject values to their associated long names
 */
export const getLongNamesMap = async (scheme) => {
  try {
    // Make a SPARQL request to fetch long names
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getLongNamesQuery(scheme)
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

    // Iterate through each triple in the results
    triples.forEach((triple) => {
      // If the subject doesn't exist in the map, initialize it with an empty array
      if (!map[triple.subject.value]) {
        map[triple.subject.value] = []
      }

      // If the 'bo' value is not 'primary', add it to the array for this subject
      if (triple.bo.value !== 'primary') {
        map[triple.subject.value].push(triple.bo.value)
      }
    })

    // Return the completed map
    return map
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error fetching triples:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
