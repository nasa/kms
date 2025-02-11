import conceptIdExists from '../utils/conceptIdExists'
import { getApplicationConfig } from '../utils/getConfig'
import { sparqlRequest } from '../utils/sparqlRequest'

/**
 * Updates existing SKOS Concepts
 * @param {Object} event Details about the HTTP request that it received
 */
const updateConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml } = event
  const { conceptId } = event.pathParameters // Assuming the concept ID is passed as a path parameter

  // Construct the full IRI
  const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

  try {
    const exists = await conceptIdExists(conceptIRI)
    if (!exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Concept ${conceptIRI} not found` }),
        headers: defaultResponseHeaders
      }
    }

    // If the concept exists, proceed with the update
    const response = await sparqlRequest({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: rdfXml
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`Successfully updated concept: ${conceptId}`)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully updated concept: ${conceptId}` }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error updating concept:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default updateConcept
