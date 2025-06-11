import { deleteTriples } from '@/shared/deleteTriples'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSkosRootConcept } from '@/shared/getSkosRootConcept'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'

/**
 * Deletes a concept scheme and its root concept from the knowledge management system.
 *
 * @param {Object} event - The Lambda event object
 * @param {Object} event.pathParameters - Path parameters from the API Gateway
 * @param {string} event.pathParameters.schemeId - The ID of the concept scheme to delete
 * @param {Object} event.queryStringParameters - Query string parameters
 * @param {string} [event.queryStringParameters.version='draft'] - The version of the concept scheme (default: 'draft')
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode: HTTP status code
 *   - headers: Response headers
 *   - body: JSON stringified response body
 *
 * @throws {Error} If there's an issue deleting the concept scheme or root concept
 *
 * @example
 * // Usage in an AWS Lambda function
 * export const handler = async (event) => {
 *   try {
 *     const result = await deleteConceptScheme(event);
 *     return result;
 *   } catch (error) {
 *     console.error('Error in Lambda handler:', error);
 *     return {
 *       statusCode: 500,
 *       body: JSON.stringify({ error: 'Internal Server Error' })
 *     };
 *   }
 * };
 */
export const deleteConceptScheme = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters, queryStringParameters } = event
  const { schemeId } = pathParameters
  const version = queryStringParameters?.version || 'draft'

  logAnalyticsData({
    event,
    context
  })

  let transactionUrl
  try {
    // Fetch concept scheme details
    const scheme = await getConceptSchemeDetails({
      schemeName: schemeId,
      version
    })

    // If scheme is not found, return a 404 response
    if (scheme === null) {
      return {
        statusCode: 404,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Scheme not found'
        })
      }
    }

    // Start a transaction
    transactionUrl = await startTransaction()

    // Get the root concept of the scheme
    const skosRootConcept = await getSkosRootConcept(schemeId)

    if (skosRootConcept) {
      // Check if the root concept has any narrower concepts
      const hasNarrowerEntries = Array.isArray(skosRootConcept['skos:narrower']) && skosRootConcept['skos:narrower'].length > 0
      // If root concept has narrower concepts, return a 422 response
      if (hasNarrowerEntries) {
        return {
          statusCode: 422, // Unprocessable Entity
          headers: {
            ...defaultResponseHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: "Scheme can't be deleted: Root concept has narrowers."
          })
        }
      }

      // Extract concept ID and construct IRIs for concept and scheme
      const conceptId = skosRootConcept['@rdf:about']
      const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`
      // Delete the root concept triples
      const deleteResponse = await deleteTriples(conceptIRI, version, transactionUrl)
      if (!deleteResponse.ok) {
        throw new Error('Failed to delete existing root concept')
      }
    }

    const schemeIRI = `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}`

    // Delete the scheme triples
    const deleteResponse = await deleteTriples(schemeIRI, version, transactionUrl)
    if (!deleteResponse.ok) {
      throw new Error('Failed to delete existing scheme')
    }

    // Commit the transaction
    await commitTransaction(transactionUrl)

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully deleted concept scheme: ${schemeId}` }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    // Log and return error response if an exception occurs
    console.error(`Error deleting concept scheme, error=${error.toString()}`)

    // Rollback the transaction if an error occurred
    if (transactionUrl) {
      try {
        await rollbackTransaction(transactionUrl)
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError)
      }
    }

    // Return error response
    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default deleteConceptScheme
