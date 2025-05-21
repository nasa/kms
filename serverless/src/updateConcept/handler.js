import { conceptIdExists } from '@/shared/conceptIdExists'
import { deleteTriples } from '@/shared/deleteTriples'
import { ensureInScheme } from '@/shared/ensureInScheme'
import { ensureReciprocalRelations } from '@/shared/ensureReciprocalRelations'
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
 * @param {string} event.queryStringParameters.scheme - The scheme to which the concept belongs.
 * @param {string} [event.queryStringParameters.userNote] - Optional user note for the update.
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object for updating a concept in the draft version
 * const eventDraft = {
 *   body: '<rdf:RDF>...</rdf:RDF>',
 *   pathParameters: { conceptId: '123' },
 *   queryStringParameters: {
 *     version: 'draft',
 *     scheme: 'sciencekeywords',
 *     userNote: 'Updated concept description'
 *   }
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
 *   queryStringParameters: {
 *     version: 'published',
 *     scheme: 'instruments',
 *     userNote: 'Updated instrument details'
 *   }
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
 * curl -X POST https://your-api-endpoint.com/update-concept \
 *   -H "Content-Type: application/xml" \
 *   -d @your-rdf-file.xml \
 *   -G --data-urlencode "version=draft" \
 *   --data-urlencode "scheme=sciencekeywords" \
 *   --data-urlencode "userNote=Updated concept description"
 *
 * // Response:
 * // {
 * //   "statusCode": 200,
 * //   "body": "{\"message\":\"Successfully updated concept: 123\"}",
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
  const scheme = queryStringParameters?.scheme
  const userNote = queryStringParameters?.userNote

  console.log('userNote=', userNote)

  try {
    if (!rdfXml) {
      throw new Error('Missing RDF/XML data in request body')
    }

    if (!scheme) {
      throw new Error('Missing scheme parameter')
    }

    // Ensure the skos:inScheme element is present
    const updatedRdfXml = ensureInScheme(rdfXml, scheme)
    // Check conceptId
    const conceptId = getConceptId(updatedRdfXml)
    if (!conceptId) {
      throw new Error('Invalid or missing concept ID')
    }

    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

    const isUpdate = await conceptIdExists(conceptIRI, version)

    // Start transaction
    const transactionUrl = await startTransaction()

    if (isUpdate) {
      // Delete existing triples and get the deleted data
      const deleteResponse = await deleteTriples(conceptIRI, version, transactionUrl)

      if (!deleteResponse.ok) {
        throw new Error('Failed to delete existing triples')
      }
    }

    // Try to insert the new data
    try {
      const insertResponse = await sparqlRequest({
        method: 'PUT',
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        body: updatedRdfXml,
        version,
        transaction: {
          transactionUrl,
          action: 'ADD'
        }
      })

      if (!insertResponse.ok) {
        throw new Error(`HTTP error! insert new data status: ${insertResponse.status}`)
      }

      const insertReciprocalRelationsResponse = await ensureReciprocalRelations({
        rdfXml: updatedRdfXml,
        conceptId,
        version,
        transactionUrl
      })
      if (!insertReciprocalRelationsResponse.ok) {
        throw new Error(`HTTP error! insert reciprocal relations status: ${insertReciprocalRelationsResponse.status}`)
      }

      // Update the modified date
      const today = new Date().toISOString()
      const updateModifiedSuccess = await updateModifiedDate(
        conceptId,
        version,
        today,
        transactionUrl
      )

      if (!updateModifiedSuccess) {
        throw new Error('HTTP error! updating last modified date failed')
      }

      // Commit transaction
      await commitTransaction(transactionUrl)

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
