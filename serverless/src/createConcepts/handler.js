import { getApplicationConfig } from '../utils/getConfig'
import { sparqlRequest } from '../utils/sparqlRequest'

/**
 * Creates new SKOS Concepts in the RDF store.
 *
 * This function takes RDF/XML data representing one or more SKOS concepts and
 * adds them to the RDF store using a SPARQL endpoint.
 *
 * @async
 * @function createConcept
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML representation of the concept(s) to be created.
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object
 * const event = {
 *   body: `
 *     <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
 *              xmlns:skos="http://www.w3.org/2004/02/skos/core#">
 *       <skos:Concept rdf:about="http://example.com/concept/123">
 *         <skos:prefLabel>Example Concept</skos:prefLabel>
 *       </skos:Concept>
 *     </rdf:RDF>
 *   `
 * };
 *
 * const result = await createConcept(event);
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: 'Successfully loaded RDF XML into RDF4J',
 * //   headers: { ... }
 * // }
 */const createConcept = async (event) => {
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
