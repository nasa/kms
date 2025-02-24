import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Provides a status check for the RDF4J database connection.
 *
 * This function attempts to connect to the RDF4J server's protocol endpoint
 * to verify that the database connection is healthy. It returns a success
 * response if the connection is established, or an error response if the
 * connection fails.
 *
 * @async
 * @function status
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * const result = await status();
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: 'Database connection healthy',
 * //   headers: {
 * //     'Content-Type': 'text/plain',
 * //     ... other headers ...
 * //   }
 * // }
 *
 * // Output on failure:
 * // {
 * //   statusCode: 500,
 * //   body: '{"error":"Failed to fetch RDF4J status"}',
 * //   headers: { ... }
 * // }
 */
export const status = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const rdf4jServiceUrl = process.env.RDF4J_SERVICE_URL

  try {
    // Construct the protocol endpoint URL
    const protocolEndpointUrl = `${rdf4jServiceUrl}/rdf4j-server/protocol`

    // Make a GET request to the protocol endpoint
    const response = await fetch(protocolEndpointUrl)
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
