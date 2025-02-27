/**
 * Utility module for making SPARQL requests to an RDFDB server.
 *
 * @module sparqlRequest
 */

import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Sends a request to the SPARQL endpoint with the specified parameters.
 *
 * This function constructs and sends an HTTP request to the configured SPARQL endpoint,
 * handling authentication and content type specifications.
 *
 * @async
 * @function sparqlRequest
 * @param {Object} options - The options for the SPARQL request.
 *  * @param {string} [options.type=''] - The type of request (query, update, data)
 * @param {string} options.method - The HTTP method to use for the request (e.g., 'GET', 'POST').
 * @param {string|Object} [options.body] - The body of the request, if applicable.
 * @param {string} [options.contentType'] - The Content-Type header for the request.
 * @param {string} [options.accept'] - The Accept header for the request.
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object.
 *
 * @example
 * const response = await sparqlRequest({type: 'query',
 *   method: 'POST',
 *   body: 'SELECT * WHERE { ?s ?p ?o }',
 *   contentType: 'application/sparql-query',
 *   accept: 'application/sparql-results+json'
 * });
 *
 * @throws Will throw an error if the fetch operation fails.
 */
export const sparqlRequest = async ({
  type = 'query',
  method,
  body,
  contentType,
  accept
}) => {
  /**
    * Constructs the SPARQL endpoint URL using environment variables.
    *
    * @private
    * @function getSparqlEndpoint
    * @returns {string} The full URL of the SPARQL endpoint.
    */
  const getSparqlEndpoint = () => {
    const { sparqlQueryEndpoint, sparqlUpdateEndpoint, sparqlDataEndpoint } = getApplicationConfig()
    if (type === 'query') {
      return sparqlQueryEndpoint
    }

    if (type === 'update') {
      return sparqlUpdateEndpoint
    }

    if (type === 'data') {
      return sparqlDataEndpoint
    }

    throw new Error('Invalid sparql query type')
  }

  /**
    * Generates the Basic Auth header using credentials from environment variables.
    *
    * @private
    * @function getAuthHeader
    * @returns {string} The Basic Auth header value.
    */
  const getAuthHeader = () => {
    const username = process.env.RDFDB_USER_NAME
    const password = process.env.RDFDB_PASSWORD

    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }

  const endpoint = getSparqlEndpoint()
  const authHeader = getAuthHeader()

  console.log('calling ', endpoint)

  return fetch(`${endpoint}`, {
    method,
    headers: {
      'Content-Type': contentType,
      Accept: accept,
      Authorization: authHeader
    },
    body
  })
}
