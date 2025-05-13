import { conceptIdExists } from '@/shared/conceptIdExists'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { getCreatedDate } from '@/shared/getCreatedDate'
import { getModifiedDate } from '@/shared/getModifiedDate'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { updateCreatedDate } from '@/shared/updateCreatedDate'
import { updateModifiedDate } from '@/shared/updateModifiedDate'

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
 * @param {Object} event.queryStringParameters - Query string parameters.
 * @param {string} [event.queryStringParameters.version='draft'] - The version of the concept (default is 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Curl command to create a new concept
 * curl -X POST https://your-api-endpoint.com/concept?version=draft \
 *   -H "Content-Type: application/rdf+xml" \
 *   -d @concept.rdf
 *
 * // Where concept.rdf is a file containing the RDF/XML representation of the concept.
 * // The 'version' query parameter is optional and defaults to 'draft'.
 *
 * // Example response:
 * // {
 * //   "statusCode": 201,
 * //   "body": "{\"message\":\"Successfully created concept\",\"conceptId\":\"123\"}",
 * //   "headers": {
 * //     "Content-Type": "application/json",
 * //     "Access-Control-Allow-Origin": "*"
 * //   }
 * // }
 */
export const createConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  try {
    if (!rdfXml) {
      throw new Error('Missing RDF/XML data in request body')
    }

    const conceptId = getConceptId(rdfXml)
    if (!conceptId) {
      throw new Error('Invalid or missing concept ID')
    }

    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

    const exists = await conceptIdExists(conceptIRI, version)
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
      method: 'POST',
      body: rdfXml,
      version
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log('Successfully loaded RDF XML into RDF4J')

    // Check for creation date and add if not present
    const createdDate = await getCreatedDate(conceptId, version)
    const modifiedDate = await getModifiedDate(conceptId, version)
    const today = new Date().toISOString()

    if (!createdDate) {
      const createDateSuccess = await updateCreatedDate(conceptId, version, today)
      if (!createDateSuccess) {
        console.warn(`Failed to add creation date for concept ${conceptId}`)
      } else {
        console.log(`Added creation date ${today} for concept ${conceptId}`)
      }
    }

    if (!modifiedDate) {
      const modifiedDateSuccess = await updateModifiedDate(conceptId, version, today)
      if (!modifiedDateSuccess) {
        console.warn(`Failed to update modified date for concept ${conceptId}`)
      } else {
        console.log(`Updated modified date ${today} for concept ${conceptId}`)
      }
    }

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

export default createConcept
