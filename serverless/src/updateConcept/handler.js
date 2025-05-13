import { conceptIdExists } from '@/shared/conceptIdExists'
import { deleteTriples } from '@/shared/deleteTriples'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateModifiedDate } from '@/shared/updateModifiedDate'

/**
 * Updates an existing SKOS Concept in the RDF store for a specific version.
 *
 * This function checks if the specified concept exists in the given version, and if so, updates it
 * with the provided RDF/XML data. If the concept doesn't exist, it returns a 404 error.
 * The function includes a rollback mechanism in case of failure during the update process.
 *
 * @async
 * @function updateConcept
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML representation of the updated concept.
 * @param {Object} event.queryStringParameters - Query string parameters.
 * @param {string} [event.queryStringParameters.version='draft'] - The version to update (default is 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object for updating a concept in the draft version
 * const eventDraft = {
 *   body: '<rdf:RDF>...</rdf:RDF>',
 *   pathParameters: { conceptId: '123' },
 *   queryStringParameters: { version: 'draft' }
 * };
 *
 * const resultDraft = await updateConcept(eventDraft);
 * console.log(resultDraft);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '{"message":"Successfully updated concept: 123"}',
 * //   headers: { ... }
 * // }
 *
 * @example
 * // Lambda event object for updating a concept in the published version
 * const eventPublished = {
 *   body: '<rdf:RDF>...</rdf:RDF>',
 *   pathParameters: { conceptId: '456' },
 *   queryStringParameters: { version: 'published' }
 * };
 *
 * const resultPublished = await updateConcept(eventPublished);
 * console.log(resultPublished);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '{"message":"Successfully updated concept: 456"}',
 * //   headers: { ... }
 * // }
 * @example
 * curl -X POST https://your-api-endpoint.com/upload-rdf \
 *   -H "Content-Type: application/xml" \
 *   -d @your-rdf-file.xml \
 *   -G --data-urlencode "version=draft"
 *
 * // Response:
 * // {
 * //   "statusCode": 200,
 * //   "body": "{\"message\":\"Successfully loaded RDF data into RDF4J\"}",
 * //   "headers": {
 * //     "Content-Type": "application/json",
 * //     "Access-Control-Allow-Origin": "*"
 * //   }
 * // }
 * @throws Will return an object with error details if the update process fails.
 *
 * @see Related functions:
 * {@link conceptIdExists}
 * {@link deleteTriples}
 * {@link getConceptId}
 * {@link rollback}
 * {@link sparqlRequest}
 */
export const updateConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  let transactionUrl = null

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
    if (!exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Concept ${conceptIRI} not found` }),
        headers: defaultResponseHeaders
      }
    }

    transactionUrl = await startTransaction()

    // Delete existing triples and get the deleted data
    const deleteResponse = await deleteTriples(conceptIRI, version, transactionUrl)

    if (!deleteResponse.ok) {
      throw new Error('Failed to delete existing triples')
    }

    console.log(`Successfully deleted concept: ${conceptId}`)

    // Try to insert the new data
    try {
      const insertResponse = await sparqlRequest({
        method: 'PUT',
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        body: rdfXml,
        version,
        transaction: {
          transactionUrl,
          action: 'ADD'
        }
      })

      if (!insertResponse.ok) {
        throw new Error(`HTTP error! insert status: ${insertResponse.status}`)
      }

      console.log(`Successfully updated concept: ${conceptId}`)

      // Update the modified date
      const today = new Date().toISOString()
      const updateModifiedSuccess = await updateModifiedDate(
        conceptId,
        version,
        today,
        transactionUrl
      )

      if (!updateModifiedSuccess) {
        console.warn(`Failed to update modified date for concept ${conceptId}`)
      } else {
        console.log(`Updated modified date to ${today} for concept ${conceptId}`)
      }

      console.log('comitting transaction')
      await commitTransaction(transactionUrl)
      console.log('done comitting transaction')

      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully updated concept: ${conceptId}` }),
        headers: defaultResponseHeaders
      }
    } catch (insertError) {
      console.error('Error inserting new data, rolling back:', insertError)

      // Rollback the transaction if an error occurred
      if (transactionUrl) {
        try {
          await rollbackTransaction(transactionUrl)
          console.log('Transaction rolled back due to error')
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError)
        }
      }

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
