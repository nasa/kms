import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Provides a status check for the RDF4J database connection and reports the number of triples.
 *
 * This function performs two main operations:
 * 1. Attempts to connect to the RDF4J server's protocol endpoint to verify that the database connection is healthy.
 * 2. Executes a SPARQL query to count the total number of triples in the published version of the graph.
 *
 * It returns a success response if both operations are successful, or an error response if either fails.
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
 * //   body: 'Database connection healthy. 1000000 triples in published version.',
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
 *
 * @throws Will log errors if the connection to RDF4J fails or if the SPARQL query fails.
 *         These errors are caught and transformed into a 500 status response.
 *
 * @requires getApplicationConfig - Function to retrieve application configuration.
 * @requires sparqlRequest - Function to make SPARQL requests to the RDF4J server.
 * @requires RDF4J_SERVICE_URL - Environment variable containing the URL of the RDF4J service.
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

    // SPARQL query to count triples in the published graph
    const countQuery = `
SELECT (COUNT(*) AS ?count)
WHERE {
    ?s ?p ?o
}
`

    const countResponse = await sparqlRequest({
      method: 'POST',
      body: countQuery,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version: 'published'
    })

    const countData = await countResponse.json()
    const tripleCount = countData.results.bindings[0].count.value

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'text/plain' // Assuming the protocol endpoint returns XML
      },
      body: `Database connection healthy.  ${tripleCount} triples in published version.`
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
