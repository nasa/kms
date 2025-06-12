import { addChangeNotes } from '@/shared/addChangeNotes'
import { captureRelations } from '@/shared/captureRelations'
import { compareRelations } from '@/shared/compareRelations'
import { deleteTriples } from '@/shared/deleteTriples'
import { ensureReciprocal } from '@/shared/ensureReciprocal'
import { getConceptById } from '@/shared/getConceptById'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
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
 * This function performs the following steps:
 * 1. Validates the input RDF/XML data and conceptId
 * 2. Retrieves the existing concept data
 * 3. Starts a transaction
 * 4. Captures existing relations
 * 5. Deletes the existing concept (if it exists)
 * 6. Inserts the updated concept
 * 7. Ensures reciprocal relationships are handled
 * 8. Captures updated relations
 * 9. Compares before and after relations
 * 10. Generates and adds change notes for modified relations
 * 11. Updates the modification date
 * 12. Commits the transaction
 *
 * If any step fails, the transaction is rolled back.
 *
 * @async
 * @function updateConcept
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML representation of the updated concept.
 * @param {Object} event.queryStringParameters - Query string parameters.
 * @param {string} [event.queryStringParameters.version='draft'] - The version to update (default is 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode: HTTP status code (200 for success, 500 for failure)
 *   - body: JSON string with a message (and error details for failure)
 *   - headers: Response headers including CORS and content type
 * @throws {Error} If there's an issue during the concept update process.
 *
 * @example
 * // Successful response:
 * {
 *   statusCode: 200,
 *   body: '{"message":"Successfully updated concept: 123"}',
 *   headers: {
 *     "Content-Type": "application/json",
 *     "Access-Control-Allow-Origin": "*"
 *   }
 * }
 *
 * @example
 * // Error response:
 * {
 *   statusCode: 500,
 *   body: '{"message":"Error updating concept","error":"Invalid or missing concept ID"}',
 *   headers: {
 *     "Content-Type": "application/json",
 *     "Access-Control-Allow-Origin": "*"
 *   }
 * }
 *
 * @example
 * // Curl command to update a concept
 * curl -X PUT https://your-api-endpoint.com/concept/123?version=draft \
 *   -H "Content-Type: application/rdf+xml" \
 *   -d @updated_concept.rdf
 *
 * // Where updated_concept.rdf is a file containing the updated RDF/XML representation of the concept.
 * // The 'version' query parameter is optional and defaults to 'draft'.
 */

export const updateConcept = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: newRdfXml, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  logAnalyticsData({
    event,
    context
  })

  try {
    if (!newRdfXml) {
      throw new Error('Missing RDF/XML data in request body')
    }

    // Check conceptId
    const conceptId = getConceptId(newRdfXml)
    if (!conceptId) {
      throw new Error('Invalid or missing concept ID')
    }

    const oldRdfXml = await getConceptById(conceptId, version)
    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

    // Start transaction
    const transactionUrl = await startTransaction()

    const beforeRelations = await captureRelations(conceptId, version, transactionUrl)

    try {
      if (oldRdfXml) {
        // Remove existing concept
        const deleteResponse = await deleteTriples(conceptIRI, version, transactionUrl)
        if (!deleteResponse.ok) {
          throw new Error('Failed to delete existing concept')
        }
      }

      // Insert updated concept
      const insertResponse = await sparqlRequest({
        method: 'PUT',
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        body: newRdfXml,
        version,
        transaction: {
          transactionUrl,
          action: 'ADD'
        }
      })

      if (!insertResponse.ok) {
        throw new Error(`HTTP error! insert/update data status: ${insertResponse.status}`)
      }

      // Ensure reciprocal relationships
      await ensureReciprocal({
        oldRdfXml,
        newRdfXml,
        conceptId,
        version,
        transactionUrl
      })

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

      // Capture relations after update
      const afterRelations = await captureRelations(conceptId, version, transactionUrl)

      // Compare before and after relations
      const { addedRelations, removedRelations } = compareRelations(beforeRelations, afterRelations)

      // Generate and add change notes
      if (addedRelations.length > 0 || removedRelations.length > 0) {
        await addChangeNotes(addedRelations, removedRelations, version, transactionUrl)
      }

      // Commit transaction
      await commitTransaction(transactionUrl)

      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Successfully updated concept: ${conceptId}` }),
        headers: defaultResponseHeaders
      }
    } catch (error) {
      // Rollback the transaction if an error occurred
      if (transactionUrl) {
        try {
          await rollbackTransaction(transactionUrl)
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError)
        }
      }

      throw error
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
