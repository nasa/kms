import { getApplicationConfig } from './getConfig'

/**
 * Retrieves all triples from the configured SPARQL endpoint.
 *
 * This function performs the following operations:
 * 1. Retrieves authentication credentials from environment variables.
 * 2. Constructs a SPARQL query to fetch all triples in the database given the specified filter (filter work tbd)
 * 3. Sends an authenticated request to the SPARQL endpoint.
 * 4. Processes and returns the SPARQL query results.
 *
 * The SPARQL query used is a simple SELECT that retrieves all distinct subject-predicate-object triples.
 *
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects.
 *                           Each triple object contains 's' (subject), 'p' (predicate), and 'o' (object) properties.
 *
 * @throws {Error} If the HTTP request fails, if the response is not ok,
 *                 or if there's any error during the fetching or processing of the triples.
 *
 * @example
 * try {
 *   const triples = await getFilteredTriples();
 *   console.log(triples);
 * } catch (error) {
 *   console.error('Failed to get triples:', error);
 * }
 *
 * @note This function requires the following environment variables to be set:
 *       - RDF4J_USER_NAME: Username for authenticating with the SPARQL endpoint
 *       - RDF4J_PASSWORD: Password for authenticating with the SPARQL endpoint
 *
 * @see getApplicationConfig - Used to retrieve the SPARQL endpoint URL.
 */

const getFilteredTriples = async () => {
  // Get credentials from environment variables
  const username = process.env.RDF4J_USER_NAME
  const password = process.env.RDF4J_PASSWORD

  // Create the basic auth header
  const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

  const sparqlQuery = `
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  SELECT DISTINCT ?s ?p ?o
  WHERE
    {
      ?s ?p ?o .
    } 
`
  const { sparqlEndpoint } = getApplicationConfig()

  try {
    const response = await fetch(`${sparqlEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: 'application/sparql-results+json',
        Authorization: `Basic ${base64Credentials}`
      },
      body: sparqlQuery
    })

    if (!response.ok) {
      console.log('response=', await response.text())
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    return json.results.bindings
  } catch (error) {
    console.error('Error fetching SKOS identifiers:', error)
    throw error
  }
}

export default getFilteredTriples
