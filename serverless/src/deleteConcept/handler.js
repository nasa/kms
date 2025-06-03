/**
 * Deletes a SKOS Concept from the RDF store based on its conceptId.
 *
 * This function performs the following steps:
 * 1. Validates the input conceptId
 * 2. Checks if the concept exists
 * 3. Starts a transaction
 * 4. Retrieves the existing concept data
 * 5. Ensures reciprocal relationships are handled
 * 6. Deletes all triples where the specified concept is the subject
 * 7. Commits the transaction
 *
 * If any step fails, the transaction is rolled back.
 *
 * @async
 * @function deleteConcept
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} event.pathParameters.conceptId - The ID of the concept to be deleted.
 * @param {Object} event.queryStringParameters - Query string parameters.
 * @param {string} [event.queryStringParameters.version='draft'] - The version of the concept to delete (default is 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode: HTTP status code (200 for success, 400, 404, or 500 for failure)
 *   - body: JSON string with a message (and error details for failure)
 *   - headers: Response headers including CORS and content type
 * @throws {Error} If there's an issue during the concept deletion process.
 *
 * @example
 * // Successful response:
 * {
 *   statusCode: 200,
 *   body: '{"message":"Successfully deleted concept: 123"}',
 *   headers: {
 *     "Content-Type": "application/json",
 *     "Access-Control-Allow-Origin": "*"
 *   }
 * }
 *
 * // Error response:
 * {
 *   statusCode: 404,
 *   body: '{"message":"Concept not found: 123"}',
 *   headers: {
 *     "Content-Type": "application/json",
 *     "Access-Control-Allow-Origin": "*"
 *   }
 * }
 */
import { addChangeNotes } from '@/shared/addChangeNotes'
import { captureRelations } from '@/shared/captureRelations'
import { compareRelations } from '@/shared/compareRelations'
import { conceptIdExists } from '@/shared/conceptIdExists'
import { deleteTriples } from '@/shared/deleteTriples'
import { ensureReciprocal } from '@/shared/ensureReciprocal'
import { getConceptById } from '@/shared/getConceptById'
import { getApplicationConfig } from '@/shared/getConfig'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'

export const deleteConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters, queryStringParameters } = event
  const { conceptId } = pathParameters
  const version = queryStringParameters?.version || 'draft'

  if (!conceptId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing conceptId in path parameters' }),
      headers: defaultResponseHeaders
    }
  }

  const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

  let transactionUrl

  try {
    // Check if the concept exists
    const exists = await conceptIdExists(conceptIRI, version)

    if (!exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Concept not found: ${conceptId}` }),
        headers: defaultResponseHeaders
      }
    }

    // Start transaction
    transactionUrl = await startTransaction()

    const beforeRelations = await captureRelations(conceptId, version, transactionUrl)

    // Get the existing concept data
    const oldRdfXml = await getConceptById(conceptId, version)

    // Ensure reciprocal relationships are handled
    await ensureReciprocal({
      oldRdfXml,
      newRdfXml: null, // No new RDF/XML for deletion
      conceptId,
      version,
      transactionUrl
    })

    // Delete the concept
    const response = await deleteTriples(conceptIRI, version, transactionUrl)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
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

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully deleted concept: ${conceptId}` }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error deleting concept:', error)

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
        message: 'Error deleting concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}
