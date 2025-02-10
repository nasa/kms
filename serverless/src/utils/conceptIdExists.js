const { getApplicationConfig } = require('./getConfig')

/**
 * Checks if a concept with the given IRI exists
 * @param {string} conceptIRI The full IRI of the concept to check
 * @param {string} sparqlEndpoint The SPARQL endpoint URL
 * @returns {Promise<boolean>} True if the concept exists, false otherwise
 */
const conceptIdExists = async (conceptIRI) => {
  const { sparqlEndpoint } = getApplicationConfig()

  // Get credentials from environment variables
  const username = process.env.RDF4J_USER_NAME
  const password = process.env.RDF4J_PASSWORD

  // Create the basic auth header
  const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

  const checkQuery = `
    SELECT ?p ?o 
    WHERE { <${conceptIRI}> ?p ?o } 
    LIMIT 1
  `
  const checkResponse = await fetch(`${sparqlEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      Accept: 'application/sparql-results+json',
      Authorization: `Basic ${base64Credentials}`
    },
    body: checkQuery
  })

  if (!checkResponse.ok) {
    const errorText = await checkResponse.text()
    console.error(`Error response: ${errorText}`)
    throw new Error(`Error checking concept existence: ${checkResponse.status}. ${errorText}`)
  }

  const checkResult = await checkResponse.json()
  console.log('checkResult=', checkResult, checkResult.results.bindings.length > 0)

  return checkResult.results.bindings.length > 0
}

export default conceptIdExists
