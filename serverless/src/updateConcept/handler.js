import { getApplicationConfig } from '../utils/getConfig'
import { sparqlRequest } from '../utils/sparqlRequest'
import conceptIdExists from '../utils/conceptIdExists'
import deleteTriples from '../utils/deleteTriples'
import rollback from '../utils/rollback'

/**
 * Updates an existing SKOS Concept in the RDF store.
 *
 * This function checks if the specified concept exists, and if so, updates it
 * with the provided RDF/XML data. If the concept doesn't exist, it returns a 404 error.
 *
 * @async
 * @function updateConcept
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML representation of the updated concept.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} event.pathParameters.conceptId - The ID of the concept to update.
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object
 * const event = {
 *   body: '<rdf:RDF>...</rdf:RDF>',
 *   pathParameters: { conceptId: '123' }
 * };
 *
 * const result = await updateConcept(event);
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '{"message":"Successfully updated concept: 123"}',
 * //   headers: { ... }
 * // }
 */

const updateConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml } = event
  const { conceptId } = event.pathParameters

  const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

  try {
    const exists = await conceptIdExists(conceptIRI)
    if (!exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Concept ${conceptIRI} not found` }),
        headers: defaultResponseHeaders
      }
    }

    // Delete existing triples and get the deleted data
    const { deletedTriples, deleteResponse } = await deleteTriples(conceptIRI)

    if (!deleteResponse.ok) {
      throw new Error(`HTTP error! delete status: ${deleteResponse.status}`)
    }

    console.log(`Successfully deleted concept: ${conceptId}`)

    // Try to insert the new data
    try {
      const insertResponse = await sparqlRequest({
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        path: '/statements',
        method: 'POST',
        body: rdfXml
      })

      if (!insertResponse.ok) {
        throw new Error(`HTTP error! insert status: ${insertResponse.status}`)
      }

      console.log(`Successfully updated concept: ${conceptId}`)

      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully updated concept: ${conceptId}` }),
        headers: defaultResponseHeaders
      }
    } catch (insertError) {
      console.error('Error inserting new data, rolling back:', insertError)

      // Rollback: reinsert the deleted triples
      await rollback(deletedTriples)

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: insertError.message
        }),
        headers: defaultResponseHeaders
      }
    }
  } catch (error) {
    console.error('Error updating concept:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default updateConcept
