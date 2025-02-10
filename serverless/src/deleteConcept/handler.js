import { getApplicationConfig } from '../utils/getConfig'

/**
 * Deletes a SKOS Concept based on its rdf:about identifier
 * @param {Object} event Details about the HTTP request that it received
 */
const deleteConcept = async (event) => {
  const { defaultResponseHeaders, sparqlEndpoint } = getApplicationConfig()
  const { pathParameters } = event
  const { conceptId } = pathParameters

  // Get credentials from environment variables
  const username = process.env.RDF4J_USER_NAME
  const password = process.env.RDF4J_PASSWORD

  // Create the basic auth header
  const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')
  // Construct the full IRI
  const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

  // Construct the SPARQL DELETE query
  const deleteQuery = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    DELETE {
      ?s ?p ?o .
    }
    WHERE {
      ?s ?p ?o .
      FILTER(?s = <${conceptIRI}>)
    }
  `

  try {
    const response = await fetch(`${sparqlEndpoint}/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
        Accept: 'application/sparql-results+json',
        Authorization: `Basic ${base64Credentials}`
      },
      body: deleteQuery
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`Successfully deleted concept: ${conceptId}`)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully deleted concept: ${conceptId}` }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error deleting concept:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default deleteConcept
