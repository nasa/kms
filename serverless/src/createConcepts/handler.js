import { getApplicationConfig } from '../utils/getConfig'
import { sparqlRequest } from '../utils/sparqlRequest'

/**
 * Creates new SKOS Concepts
 * @param {Object} event Details about the HTTP request that it received
 */
const createConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml } = event

  try {
    const response = await sparqlRequest({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: rdfXml
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log('Successfully loaded RDF XML into RDF4J')

    return {
      statusCode: 200,
      body: 'Successfully loaded RDF XML into RDF4J',
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error loading RDF XML into RDF4J:', error)

    return {
      statusCode: 500,
      body: 'Error loading RDF XML into RDF4J',
      headers: defaultResponseHeaders
    }
  }
}

export default createConcept
