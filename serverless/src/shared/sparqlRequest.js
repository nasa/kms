/* eslint-disable no-param-reassign */
/**
 * Utility module for making SPARQL requests to an RDF4J server.
 *
 * @module sparqlRequest
 */

import { delay } from '@/shared/delay'
import { logger } from '@/shared/logger'

/**
 * Sends a request to the SPARQL endpoint with the specified parameters, supporting RDF4J transactions.
 *
 * This function constructs and sends an HTTP request to the configured SPARQL endpoint,
 * handling authentication, content type specifications, version-specific graph modifications,
 * and RDF4J transactions.
 *
 * @async
 * @function sparqlRequest
 * @param {Object} options - The options for the SPARQL request.
 * @param {string} [options.path=''] - The path to append to the base SPARQL endpoint URL.
 *                                     Usually determined by contentType, but can be overridden.
 * @param {string} options.method - The HTTP method to use for the request (e.g., 'GET', 'POST', 'PUT').
 * @param {string|Object} [options.body] - The body of the request, if applicable.
 * @param {string} [options.contentType='application/sparql-query'] - The Content-Type header for the request.
 * @param {string} [options.accept='application/sparql-results+json'] - The Accept header for the request.
 * @param {string} [options.version] - The version of the graph to query or update (e.g., 'published', 'draft', or a specific version number).
 * @param {Object} [options.transaction] - Transaction details for RDF4J transactions.
 * @param {string} [options.transaction.transactionUrl] - The URL of the active transaction.
 * @param {string} [options.transaction.action] - The action to perform in the transaction (e.g., 'UPDATE', 'DELETE').
 * @param {number} [options.retryCount=0] - The current retry attempt count.
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
 * // Update the draft version within a transaction
 * const response = await sparqlRequest({
 *   method: 'PUT',
 *   body: 'INSERT DATA { <http://example.com/subject> <http://example.com/predicate> "New Value" }',
 *   contentType: 'application/sparql-query',
 *   accept: 'application/sparql-results+json',
 *   version: 'draft',
 *   transaction: {
 *     transactionUrl: 'http://example.com/rdf4j-server/repositories/kms/transactions/1234',
 *     action: 'ADD'
 *   }
 * });
 *
 * @throws Will throw an error if the fetch operation fails after max retries.
 *
 * @description
 * The path for the request is typically determined by the contentType:
 * - For 'application/sparql-update' or 'application/rdf+xml', the path is set to '/statements'.
 * - For other content types, the default path is used.
 * However, you can override this by explicitly setting the 'path' option.
 *
 * When a version is specified, the function modifies the request as follows:
 * - For SPARQL queries, it adds a FROM clause to query the specific graph.
 * - For SPARQL updates, it adds a WITH clause to update the specific graph.
 * - For statement insertions/deletions, it adds a context parameter to the URL.
 *
* For RDF4J transactions:
 * - The `method` should be set to 'PUT' for transaction operations.
 * - The `transaction.transactionUrl` should be provided with the active transaction URL.
 * - The `transaction.action` should be specified (e.g., 'UPDATE', 'DELETE') for the operation.
 * - When using transactions, the function will not append the `path` to the transaction URL.
 * - Transactions require the use of the PUT method.
 * - The `action` parameter is required for transaction operations and should be set, i.e, 'ADD', 'UPDATE'
 * - When a transaction is active, the request is sent to the transaction URL instead of the regular endpoint.
 *
 * The function includes a retry mechanism for failed requests.
 *
 * @see Related functions:
 * {@link addFromClause}
 * {@link addWithClause}
 */
const RETRY_DELAY = 1000 // 1 second
const SPARQL_REQUEST_TIMEOUT_MS = 25000
const SPARQL_WARM_WINDOW_MS = 60000
const SPARQL_COLD_MAX_RETRIES = 1
const SPARQL_WARM_MAX_RETRIES = 0
let lastSuccessfulSparqlAt = 0

export const sparqlRequest = async (props) => {
  const {
    accept,
    contentType,
    method,
    transaction = {},
    version,
    retryCount = 0,
    timeoutMs = SPARQL_REQUEST_TIMEOUT_MS
  } = props

  let {
    body,
    path = ''
  } = props

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
      logger.warn('Query already contains a FROM clause. Skipping automatic graph insertion.')

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
      logger.warn('Update already contains a WITH clause. Skipping automatic graph insertion.')

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

  const requestPromise = (async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    let timeoutId
    if (controller && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort(new Error(`SPARQL request timeout after ${timeoutMs}ms`)), timeoutMs)
    }

    try {
      const requestOptions = {
        method,
        headers,
        body
      }
      if (controller && Number.isFinite(timeoutMs) && timeoutMs > 0) {
        requestOptions.signal = controller.signal
      }

      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const responseText = await response.text()
        logger.error(`Error response body: ${responseText}`)
        throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`)
      }

      lastSuccessfulSparqlAt = Date.now()

      return response
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const isWarm = (
        Number.isFinite(SPARQL_WARM_WINDOW_MS)
        && SPARQL_WARM_WINDOW_MS > 0
        && (Date.now() - lastSuccessfulSparqlAt) < SPARQL_WARM_WINDOW_MS
      )
      const maxRetries = isWarm ? SPARQL_WARM_MAX_RETRIES : SPARQL_COLD_MAX_RETRIES

      if (retryCount < maxRetries) {
        logger.info(
          '[retry] Retrying SPARQL request'
          + ` attempt=${retryCount + 1}/${maxRetries}`
          + ` isWarm=${isWarm}`
          + ` method=${method}`
          + ` contentType=${contentType}`
          + ` url=${url}`
        )

        await delay(RETRY_DELAY)

        return sparqlRequest({
          ...props,
          retryCount: retryCount + 1
        })
      }

      if (maxRetries === 0) {
        logger.error(`SPARQL request failed without retry. isWarm=${isWarm}`)
      } else {
        logger.error(`SPARQL request failed after ${maxRetries} retry. isWarm=${isWarm}`)
      }

      throw error
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  })()

  return requestPromise
}

export const resetSparqlRequestStateForTests = () => {
  lastSuccessfulSparqlAt = 0
}
