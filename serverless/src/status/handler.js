import { getApplicationConfig } from '../utils/getConfig'

/**
 * Status endpoint
 * @param {Object} event Details about the HTTP request that it received
 */
const status = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const rdf4jServiceUrl = process.env.RDF4J_SERVICE_URL

  try {
    // Construct the protocol endpoint URL
    const protocolEndpointUrl = `${rdf4jServiceUrl}/rdf4j-server/protocol`

    // Make a GET request to the protocol endpoint
    // Create the basic auth header
    const username = 'rdf4j'
    const password = 'rdf4j'
    const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

    // Make a GET request to the protocol endpoint with basic auth
    const response = await fetch(protocolEndpointUrl, {
      headers: {
        Authorization: `Basic ${base64Credentials}`
      }
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'text/plain' // Assuming the protocol endpoint returns XML
      },
      body: 'Database connection healthy'
    }
  } catch (error) {
    console.error('Error fetching RDF4J status:', error)
    console.error('RDF4J Service URL:', rdf4jServiceUrl)
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)))

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ error: 'Failed to fetch RDF4J status' })
    }
  }
}

export default status
