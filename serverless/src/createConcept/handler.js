import conceptIdExists from '../utils/conceptIdExists'
import { getApplicationConfig } from '../utils/getConfig'

/**
 * Creates new SKOS Concepts
 * @param {Object} event Details about the HTTP request that it received
 */
const createConcept = async (event) => {
  const { defaultResponseHeaders, sparqlEndpoint } = getApplicationConfig()
  const { body: rdfXml } = event
  const { conceptId } = event.pathParameters // Assuming the concept ID is passed as a path parameter

  // Get credentials from environment variables
  const username = process.env.RDF4J_USER_NAME
  const password = process.env.RDF4J_PASSWORD

  // Create the basic auth header
  const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')
  const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`
  console.log('exists?=', conceptIdExists(conceptIRI))

  const exists = await conceptIdExists(conceptIRI)
  if (exists) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: `Concept ${conceptIRI} already exists.` }),
      headers: defaultResponseHeaders
    }
  }

  try {
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

    console.log('Successfully loaded RDF XML into RDF4J')

    return {
      statusCode: 200,
      body: 'Successfully loaded RDF XML into RDF4J',
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error loading RDF XML into RDF4J:', error)

    return {
      statusCode: 500,
      body: 'Error loading RDF XML into RDF4J',
      headers: defaultResponseHeaders
    }
  }
}

export default createConcept
