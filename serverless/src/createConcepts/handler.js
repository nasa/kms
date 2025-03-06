import { XMLParser } from 'fast-xml-parser'

import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Handler function to create multiple SKOS concepts from RDF/XML data.
 *
 * @todo Implement deletion of existing concept triples before loading new ones.
 * This function processes RDF/XML input, counts the number of concepts,
 * and loads them into an RDF4J triplestore using a SPARQL endpoint.
 *
 * This function is not quite ready for production use, as it needs to
 * delete the existing concept triples before loading the new ones; if this
 * is not done, the triplestore will contain duplicate data.
 *
 * @async
 * @function createConcepts
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML data containing SKOS concepts.
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode {number} - HTTP status code (200 for success, 400 for invalid input, 500 for server error)
 *   - body {string} - JSON stringified response body
 *   - headers {Object} - Response headers
 *
 * @example
 * // Successful creation
 * const event = { body: '<rdf:RDF>...</rdf:RDF>' };
 * const result = await createConcepts(event);
 * console.log(result);
 * // {
 * //   statusCode: 200,
 * //   body: '{"message":"Successfully loaded RDF XML into RDF4J","conceptsLoaded":5}',
 * //   headers: { ... }
 * // }
 *
 * @example
 * // Invalid input
 * const event = { body: null };
 * const result = await createConcepts(event);
 * console.log(result);
 * // {
 * //   statusCode: 400,
 * //   body: '{"message":"Invalid input: RDF/XML data is required"}',
 * //   headers: { ... }
 * // }
 */
export const createConcepts = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  if (!rdfXml || typeof rdfXml !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid input: RDF/XML data is required' }),
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      }
    }
  }

  let conceptCount = 0
  try {
    // Parse the XML and count the number of skos:Concept elements
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true
    })
    const result = parser.parse(rdfXml)

    // Count the number of Concept elements
    const concepts = result['rdf:RDF']['skos:Concept']
    // eslint-disable-next-line no-nested-ternary
    conceptCount = Array.isArray(concepts) ? concepts.length : (concepts ? 1 : 0)

    const response = await sparqlRequest({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: rdfXml,
      version
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.error('Error response:', responseText)

      return {
        statusCode: response.status,
        body: JSON.stringify({
          message: `Error from SPARQL endpoint: ${responseText}`,
          conceptsAttempted: conceptCount
        }),
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        }
      }
    }

    console.log(`Successfully loaded ${conceptCount} concepts into RDF4J`)

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully loaded RDF XML into RDF4J',
        conceptsLoaded: conceptCount
      }),
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error loading RDF XML into RDF4J:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error loading RDF XML into RDF4J',
        error: error.message,
        conceptsAttempted: conceptCount
      }),
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      }
    }
  }
}

export default createConcepts
