import conceptIdExists from '../utils/conceptIdExists'
import { getApplicationConfig } from '../utils/getConfig'

/**
 * Updates existing SKOS Concepts
 * @param {Object} event Details about the HTTP request that it received
 */
const updateConcept = async (event) => {
  const { defaultResponseHeaders, sparqlEndpoint } = getApplicationConfig()
  const { body: rdfXml } = event
  const { conceptId } = event.pathParameters // Assuming the concept ID is passed as a path parameter

  // Get credentials from environment variables
  const username = process.env.RDF4J_USER_NAME
  const password = process.env.RDF4J_PASSWORD

  // Create the basic auth header
  const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')
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
    const response = await fetch(`${sparqlEndpoint}/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/rdf+xml',
        Accept: 'application/rdf+xml',
        Authorization: `Basic ${base64Credentials}`
      },
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
