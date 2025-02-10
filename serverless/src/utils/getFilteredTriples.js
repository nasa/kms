import { getApplicationConfig } from './getConfig'

/**
 * Retrieves a SKOS concept from the RDF database given the specified uri identifier.
 * @param {String} uri the URI of the SKOS concept
 * @returns the SKOS concept represented as JSON.
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
