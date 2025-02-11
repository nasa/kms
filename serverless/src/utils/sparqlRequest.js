// Src/utils/sparqlHelper.js

export const sparqlRequest = async ({
  path = '',
  method,
  body,
  contentType = 'application/rdf+xml',
  accept = 'application/rdf+xml'
}) => {
  const getSparqlEndpoint = () => {
    const baseUrl = process.env.RDF4J_SERVICE_URL || 'http://localhost:8080'

    return `${baseUrl}/rdf4j-server/repositories/kms`
  }

  const getAuthHeader = () => {
    const username = process.env.RDF4J_USER_NAME
    const password = process.env.RDF4J_PASSWORD

    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }

  const endpoint = getSparqlEndpoint()
  const authHeader = getAuthHeader()

  return fetch(`${endpoint}${path}`, {
    method,
    headers: {
      'Content-Type': contentType,
      Accept: accept,
      Authorization: authHeader
    },
    body
  })
}
