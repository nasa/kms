/* eslint-disable no-param-reassign */
/**
 * Utility module for making SPARQL requests to an RDF4J server.
 *
 * @module sparqlRequest
 */

import { delay } from '@/shared/delay'

/**
 * Sends a request to the SPARQL endpoint with the specified parameters.
 *
 * This function constructs and sends an HTTP request to the configured SPARQL endpoint,
 * handling authentication, content type specifications, and version-specific graph modifications.
 *
 * @async
 * @function sparqlRequest
 * @param {Object} options - The options for the SPARQL request.
 * @param {string} [options.path=''] - The path to append to the base SPARQL endpoint URL.
 * @param {string} options.method - The HTTP method to use for the request (e.g., 'GET', 'POST').
 * @param {string|Object} [options.body] - The body of the request, if applicable.
 * @param {string} [options.contentType='application/rdf+xml'] - The Content-Type header for the request.
 * @param {string} [options.accept='application/rdf+xml'] - The Accept header for the request.
 * @param {string} [options.version] - The version of the graph to query or update (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object.
 *
 * @example
 * // Query the published version
 * const response = await sparqlRequest({
 *   method: 'POST',
 *   body: 'SELECT * WHERE { ?s ?p ?o }',
 *   contentType: 'application/sparql-query',
 *   accept: 'application/sparql-results+json',
 *   version: 'published'
 * });
 *
 * @example
 * // Update the draft version
 * const response = await sparqlRequest({
 *   method: 'POST',
 *   body: 'INSERT DATA { <http://example.com/subject> <http://example.com/predicate> "New Value" }',
 *   contentType: 'application/sparql-update',
 *   version: 'draft'
 * });
 *
 * @throws Will throw an error if the fetch operation fails.
 *
 * @description
 * When a version is specified, the function modifies the request as follows:
 * - For SPARQL queries, it adds a FROM clause to query the specific graph.
 * - For SPARQL updates, it adds a WITH clause to update the specific graph.
 * - For statement insertions/deletions, it adds a context parameter to the URL.
 *
 * @see Related functions:
 * {@link addFromClause}
 * {@link addWithClause}
 */

const MAX_RETRIES = 10
const RETRY_DELAY = 1000 // 1 second

export const sparqlRequest = async ({
  path = '',
  accept,
  body,
  contentType,
  method,
  transaction = {},
  version,
  retryCount = 0
}) => {
  const { transactionUrl, action } = transaction
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

  if (contentType === 'application/sparql-update'
    || contentType === 'application/rdf+xml') {
    path = '/statements'
  }

  const endpoint = transactionUrl || getSparqlEndpoint()
  const authHeader = getAuthHeader()

  let endpointUrl = new URL(`${endpoint}${path}`)
  if (transactionUrl) {
    endpointUrl = new URL(`${endpoint}`) // Transactions should not include the path
  }

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

  if (transactionUrl && action) {
    endpointUrl.searchParams.append('action', action)
  }

  const url = endpointUrl.toString()

  const startTime = performance.now()

  try {
    const response = await fetch(url, {
      method,
      headers,
      body
    })

    const endTime = performance.now()
    const duration = endTime - startTime

    console.log(`SPARQL request completed in ${duration.toFixed(2)} ms`)
    console.log(`Response status: ${response.status} ${response.statusText}`)
    console.log(`Request ${url} body: ${body}`)

    if (!response.ok) {
      const responseText = await response.text()
      // Console.error(`Error response body: ${responseText}`)
      throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`)
    }

    return response
  } catch (error) {
    const endTime = performance.now()
    const duration = endTime - startTime

    console.error(`SPARQL request failed after ${duration.toFixed(2)} ms`)
    console.log(`Request ${url} body: ${body}`)
    console.error('Error:', error)

    // Implement retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying request (attempt ${retryCount + 1} of ${MAX_RETRIES})`)
      await delay(RETRY_DELAY)

      return sparqlRequest({
        accept,
        body,
        contentType,
        path,
        transaction,
        version,
        retryCount: retryCount + 1
      })
    }

    console.error(`Max retries (${MAX_RETRIES}) reached. Giving up.`)
    throw error
  }
}
