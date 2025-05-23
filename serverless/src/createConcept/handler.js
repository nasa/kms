import { conceptIdExists } from '@/shared/conceptIdExists'
import { ensureReciprocal } from '@/shared/ensureReciprocal'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateCreatedDate } from '@/shared/updateCreatedDate'
import { updateModifiedDate } from '@/shared/updateModifiedDate'

/**
 * Handles the creation of a new concept in the SPARQL endpoint.
 *
 * This function performs the following steps:
 * 1. Validates the input RDF/XML data
 * 2. Checks if the concept already exists
 * 3. Starts a transaction
 * 4. Adds the new concept to the RDF store
 * 5. Ensures reciprocal relationships
 * 6. Adds creation and modification dates
 * 7. Commits the transaction
 *
 * If any step fails, the transaction is rolled back.
 *
 * @async
 * @function createConcept
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML representation of the concept to be created.
 * @param {Object} event.queryStringParameters - Query string parameters.
 * @param {string} [event.queryStringParameters.version='draft'] - The version of the concept (default is 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode: HTTP status code (201 for success, 400 or 409 for failure)
 *   - body: JSON string with a message and conceptId (for success) or error details (for failure)
 *   - headers: Response headers including CORS and content type
 * @throws {Error} If there's an issue during the concept creation process.
 *
 * @example
 * // Successful response:
 * {
 *   statusCode: 201,
 *   body: '{"message":"Successfully created concept","conceptId":"123"}',
 *   headers: {
 *     "Content-Type": "application/json",
 *     "Access-Control-Allow-Origin": "*"
 *   }
 * }
 *
 * // Error response:
 * {
 *   statusCode: 400,
 *   body: '{"message":"Error creating concept","error":"Invalid or missing concept ID"}',
 *   headers: {
 *     "Content-Type": "application/json",
 *     "Access-Control-Allow-Origin": "*"
 *   }
 * }
 */
export const createConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  let transactionUrl

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

    // Start transaction
    transactionUrl = await startTransaction()

    const response = await sparqlRequest({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      method: 'POST',
      body: rdfXml,
      version,
      transaction: {
        transactionUrl,
        action: 'ADD'
      }
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log('Successfully loaded RDF XML into RDF4J')

    // Ensure reciprocal relationships
    await ensureReciprocal({
      oldRdfXml: null, // There's no old RDF/XML for a new concept
      newRdfXml: rdfXml,
      conceptId,
      version,
      transactionUrl
    })

    const today = new Date().toISOString()

    // Add creation date
    const createDateSuccess = await updateCreatedDate(conceptId, version, today, transactionUrl)
    if (!createDateSuccess) {
      throw new Error(`Failed to add creation date for concept ${conceptId}`)
    }

    console.log(`Added creation date ${today} for concept ${conceptId}`)

    // Add modified date
    const modifiedDateSuccess = await updateModifiedDate(conceptId, version, today, transactionUrl)
    if (!modifiedDateSuccess) {
      throw new Error(`Failed to update modified date for concept ${conceptId}`)
    }

    console.log(`Updated modified date ${today} for concept ${conceptId}`)

    // Commit transaction
    await commitTransaction(transactionUrl)

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Successfully created concept',
        conceptId
      }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error creating concept:', error)

    // Rollback the transaction if an error occurred
    if (transactionUrl) {
      try {
        await rollbackTransaction(transactionUrl)
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError)
      }
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Error creating concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default createConcept
