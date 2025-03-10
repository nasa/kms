/* eslint-disable no-param-reassign */
/**
 * Utility module for making SPARQL requests to an RDF4J server.
 *
 * @module sparqlRequest
 */

/**
 * Sends a request to the SPARQL endpoint with the specified parameters.
 *
 * This function constructs and sends an HTTP request to the configured SPARQL endpoint,
 * handling authentication and content type specifications.
 *
 * @async
 * @function sparqlRequest
 * @param {Object} options - The options for the SPARQL request.
 * @param {string} [options.path=''] - The path to append to the base SPARQL endpoint URL.
 * @param {string} options.method - The HTTP method to use for the request (e.g., 'GET', 'POST').
 * @param {string|Object} [options.body] - The body of the request, if applicable.
 * @param {string} [options.contentType='application/rdf+xml'] - The Content-Type header for the request.
 * @param {string} [options.accept='application/rdf+xml'] - The Accept header for the request.
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object.
 *
 * @example
 * const response = await sparqlRequest({
 *   method: 'POST',
 *   body: 'SELECT * WHERE { ?s ?p ?o }',
 *   contentType: 'application/sparql-query',
 *   accept: 'application/sparql-results+json'
 * });
 *
 * @throws Will throw an error if the fetch operation fails.
 */
export const sparqlRequest = async ({
  path = '',
  method,
  body,
  contentType = 'application/rdf+xml',
  accept = 'application/rdf+xml',
  version
}) => {
  /**
    * Constructs the SPARQL endpoint URL using environment variables.
    *
    * @private
    * @function getSparqlEndpoint
    * @returns {string} The full URL of the SPARQL endpoint.
    */
  const getSparqlEndpoint = () => {
    const baseUrl = process.env.RDF4J_SERVICE_URL || 'http://localhost:8080'

    return `${baseUrl}/rdf4j-server/repositories/kms`
  }

  /**
    * Generates the Basic Auth header using credentials from environment variables.
    *
    * @private
    * @function getAuthHeader
    * @returns {string} The Basic Auth header value.
    */
  const getAuthHeader = () => {
    const username = process.env.RDF4J_USER_NAME
    const password = process.env.RDF4J_PASSWORD

    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }

  function addFromClause(query, graphUri) {
    // Check if the query already contains a FROM clause
    if (/FROM\s*</i.test(query)) {
      console.warn('Query already contains a FROM clause. Skipping automatic graph insertion.')

      return query
    }

    // Replace "WHERE {" with "FROM <graphUri> WHERE {"
    return query.replace(
      /WHERE\s*{/i,
      `FROM <${graphUri}> WHERE {`
    )
  }

  function addWithClause(update, graphUri) {
    // Check if the update already contains a WITH clause
    if (/WITH\s*</i.test(update)) {
      console.warn('Update already contains a WITH clause. Skipping automatic graph insertion.')

      return update
    }

    // Split the update into prefixes and the rest
    const parts = update.split(/(?=DELETE|INSERT|WHERE)/i)
    const prefixes = parts.filter((part) => part.trim().startsWith('PREFIX'))
    const rest = parts.filter((part) => !part.trim().startsWith('PREFIX'))

    // Insert WITH clause after the prefixes
    return `${prefixes.join('\n')}\nWITH <${graphUri}>\n${rest.join('\n')}`
  }

  const endpoint = getSparqlEndpoint()
  const authHeader = getAuthHeader()
  const endpointUrl = new URL(`${endpoint}${path}`)

  const headers = {
    'Content-Type': contentType,
    Accept: accept,
    Authorization: authHeader
  }

  if (version) {
    const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${version}`

    // Modify SPARQL queries to include FROM clause
    if (contentType === 'application/sparql-query') {
      body = addFromClause(body, graphUri)
    } else if (contentType === 'application/sparql-update') {
    // Modify SPARQL updates to include WITH clause
      body = addWithClause(body, graphUri)
    } else if (path.includes('/statements')) {
    // For statements (insertions/deletions), use the context parameter
      endpointUrl.searchParams.append('context', `<${graphUri}>`)
    }
  }

  console.log('body=', body)

  return fetch(endpointUrl.toString(), {
    method,
    headers,
    body
  })
}
