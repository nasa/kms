import { sparqlRequest } from './sparqlRequest'

/**
 * Checks if a concept with the given IRI exists
 * @param {string} conceptIRI The full IRI of the concept to check
 * @param {string} sparqlEndpoint The SPARQL endpoint URL
 * @returns {Promise<boolean>} True if the concept exists, false otherwise
 */
const conceptIdExists = async (conceptIRI) => {
  const checkQuery = `
    SELECT ?p ?o 
    WHERE { <${conceptIRI}> ?p ?o } 
    LIMIT 1
  `

  const checkResponse = await sparqlRequest({
    contentType: 'application/sparql-query',
    accept: 'application/sparql-results+json',
    method: 'POST',
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
