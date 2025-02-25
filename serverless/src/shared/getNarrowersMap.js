// Import necessary functions and modules
import { getNarrowerConceptsQuery } from '@/shared/operations/queries/getNarrowerConceptsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

// Function to get a map of narrower concepts
const getNarrowersMap = async (scheme) => {
  try {
    // Make a SPARQL request to fetch narrower concepts
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getNarrowerConceptsQuery(scheme)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings
    const map = {}

    // Iterate through the triples and build the map
    triples.forEach((triple) => {
      // If the subject doesn't exist in the map, initialize it with an empty array
      if (!map[triple.subject.value]) {
        map[triple.subject.value] = []
      }

      // Add the triple to the array associated with its subject
      map[triple.subject.value].push(triple)
    })

    // Return the constructed map
    return map
  } catch (error) {
    // Log and re-throw any errors that occur during the process
    console.error('Error fetching triples:', error)
    throw error
  }
}

// Export the function for use in other modules
export default getNarrowersMap
