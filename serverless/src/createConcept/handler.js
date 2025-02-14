import conceptIdExists from '../utils/conceptIdExists'
import { getApplicationConfig } from '../utils/getConfig'
import { sparqlRequest } from '../utils/sparqlRequest'

/**
 * Handles the creation of a new concept in the SPARQL endpoint.
 *
 * This function checks if the concept already exists, and if not, it adds the new concept
 * to the RDF store using the provided RDF/XML data.
 *
 * @async
 * @function createConcept
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML representation of the concept to be created.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} event.pathParameters.conceptId - The ID of the concept to be created.
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object
 * const event = {
 *   body: '<rdf:RDF>...</rdf:RDF>',
 *   pathParameters: { conceptId: '123' }
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
 */
const createConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml } = event
  const { conceptId } = event.pathParameters // Assuming the concept ID is passed as a path parameter

  // Create the basic auth header
  const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

  const exists = await conceptIdExists(conceptIRI)
  if (exists) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: `Concept ${conceptIRI} already exists.` }),
      headers: defaultResponseHeaders
    }
  }

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
