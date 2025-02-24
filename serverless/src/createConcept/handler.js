import { conceptIdExists } from '@/shared/conceptIdExists'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

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
export const createConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml } = event || {} // Use empty object as fallback

  try {
    if (!rdfXml) {
      throw new Error('Missing RDF/XML data in request body')
    }

    const conceptId = getConceptId(rdfXml)
    if (!conceptId) {
      throw new Error('Invalid or missing concept ID')
    }

    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

    const exists = await conceptIdExists(conceptIRI)
    if (exists) {
      return {
        statusCode: 409,
        body: JSON.stringify({ message: `Concept ${conceptIRI} already exists.` }),
        headers: defaultResponseHeaders
      }
    }

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
      statusCode: 201, // Changed from 200 to 201 Created
      body: JSON.stringify({
        message: 'Successfully created concept',
        conceptId
      }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error creating concept:', error)

    return {
      statusCode: 400, // Changed from 500 to 400 for client errors
      body: JSON.stringify({
        message: 'Error creating concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}
