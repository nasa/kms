// Import the query function for getting the root concept
import { getRootConceptQuery } from '@/shared/operations/queries/getRootConceptQuery'

// Import the function for making SPARQL requests
import { sparqlRequest } from './sparqlRequest'

// Function to get the root concept for a given scheme
const getRootConcept = async (scheme) => {
  try {
    // Make a SPARQL request to get the root concept
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getRootConceptQuery(scheme)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Check if any results were returned
    if (json.results.bindings.length === 0) {
      throw new Error(`No root concept found for scheme: ${scheme}`)
    }

    // Return the first (and presumably only) result
    return json.results.bindings[0]
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error fetching triples:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}

// Export the function for use in other modules
export default getRootConcept
