import { addCreatedDateToConceptScheme } from '@/shared/addCreatedDateToConceptScheme'
import { createRootConceptRdf } from '@/shared/createRootConceptRdf'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSchemeInfo } from '@/shared/getSchemeInfo'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'

/**
 * Creates a new concept scheme in the RDF4J triplestore.
 *
 * @param {Object} event - The Lambda event object
 * @param {string} event.body - The RDF/XML data of the concept scheme
 * @param {Object} event.queryStringParameters - Query string parameters
 * @param {string} [event.queryStringParameters.version='draft'] - The version of the scheme to create
 *
 * @returns {Object} The Lambda response object
 *
 * @example
 * // Example usage in an AWS Lambda function
 * export const handler = async (event) => {
 *   return await createConceptScheme(event);
 * };
 *
 * // Example event object
 * const event = {
 *   body: '<rdf:RDF>...</rdf:RDF>',
 *   queryStringParameters: {
 *     version: 'draft'
 *   }
 * };
 *
 * // Example successful response
 * {
 *   statusCode: 201,
 *   body: JSON.stringify({
 *     message: 'Successfully created scheme',
 *     schemeId: 'example-scheme'
 *   }),
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Access-Control-Allow-Origin': '*'
 *   }
 * }
 *
 * // Example error response
 * {
 *   statusCode: 400,
 *   body: JSON.stringify({
 *     message: 'Error creating scheme',
 *     error: 'Invalid or missing scheme ID'
 *   }),
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Access-Control-Allow-Origin': '*'
 *   }
 * }
 */
export const createConceptScheme = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: schemeRdf, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  let transactionUrl

  try {
    // Validate that RDF/XML data is provided in the request body
    if (!schemeRdf) {
      throw new Error('Missing RDF/XML data in request body')
    }

    // Extract scheme information from the provided RDF
    const schemeInfo = getSchemeInfo(schemeRdf)
    const { schemeId, schemePrefLabel } = schemeInfo
    // Validate that a scheme ID is present
    if (!schemeId) {
      throw new Error('Invalid or missing scheme ID')
    }

    // Check if the scheme already exists
    const scheme = await getConceptSchemeDetails({
      schemeName: schemeId,
      version
    })
    if (scheme) {
      // Return a conflict error if the scheme already exists
      return {
        statusCode: 409,
        body: JSON.stringify({ message: `Scheme ${schemeId} already exists.` }),
        headers: defaultResponseHeaders
      }
    }

    // Add creation date to the concept scheme RDF
    const processedSchemeRdf = addCreatedDateToConceptScheme(schemeRdf)

    // Start a new transaction
    transactionUrl = await startTransaction()
    // Send the processed scheme RDF to the triplestore
    const response = await sparqlRequest({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      method: 'POST',
      body: processedSchemeRdf,
      version,
      transaction: {
        transactionUrl,
        action: 'ADD'
      }
    })
    // Check if the request was successful
    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Create and add a root concept for the scheme
    const rootConceptRdf = createRootConceptRdf(schemeId, schemePrefLabel)

    const rootConceptResponse = await sparqlRequest({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      method: 'POST',
      body: rootConceptRdf,
      version,
      transaction: {
        transactionUrl,
        action: 'ADD'
      }
    })
    // Check if the root concept was added successfully
    if (!rootConceptResponse.ok) {
      const responseText = await rootConceptResponse.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${rootConceptResponse.status}`)
    }

    // Commit the transaction
    await commitTransaction(transactionUrl)

    console.log('Successfully loaded RDF XML into RDF4J')

    // Return a success response
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Successfully created scheme',
        schemeId
      }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error creating scheme:', error)

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
        message: 'Error creating scheme',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default createConceptScheme
