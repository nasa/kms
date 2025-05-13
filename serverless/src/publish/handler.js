import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { getVersionNames } from '@/shared/getVersionNames'
import { renameGraph } from '@/shared/renameGraph'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

/**
 * Performs the publication process for a new version of the keyword set.
 *
 * This handles the process of publishing a new version of the keyword set, including
 * managing graph transitions and updating metadata.
 *
 * The function performs the following steps:
 * 1. Validates the input to ensure a 'name' parameter is provided in the query string.
 * 2. Starts a new SPARQL transaction.
 * 3. If a 'published' version exists, it is moved to 'past_published'.
 * 4. The 'draft' version is copied to become the new 'published' version.
 * 5. Metadata for the new 'published' version is updated with the provided name and timestamp.
 * 6. Commits the transaction if all operations are successful, or rolls back if an error occurs.
 *
 * @async
 * @function publish
 * @param {Object} event - The event object passed from API Gateway.
 * @param {Object} event.queryStringParameters - The query string parameters from the API request.
 * @param {string} event.queryStringParameters.name - The name of the version to be published.
 * @returns {Promise<Object>} A promise that resolves to an object containing the response details.
 * @property {number} statusCode - The HTTP status code (200 for success, 400 for bad request, 500 for server error).
 * @property {Object} headers - The response headers, including CORS and content type settings.
 * @property {string} body - A JSON string containing the response message, version name, and publish date (for success) or error details (for failure).
 *
 * @throws {Error} If there's an issue with renaming graphs, copying data, or updating metadata.
 *
 * @example
 * // Successful invocation
 * const event = { queryStringParameters: { name: 'v1.0.0' } };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 200,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Publish process completed for version v1.0.0","version":"v1.0.0","publishDate":"2023-06-01T12:00:00.000Z"}'
 * // }
 *
 * @example
 * // Failed invocation (missing name)
 * const event = { queryStringParameters: {} };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 400,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Error: \\"name\\" parameter is required in the query string"}'
 * // }
 */
export const publish = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  // Extract name from query parameters
  const name = event.queryStringParameters?.name

  // Check if name is provided
  if (!name) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error: "name" parameter is required in the query string' })
    }
  }

  const versionNames = await getVersionNames()

  // Check if the provided name already exists
  if (versionNames.includes(name)) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: `Error: Version name "${name}" already exists` })
    }
  }

  let transactionUrl = null
  try {
    // Start a new transaction
    transactionUrl = await startTransaction()

    // 1. Move published to past_published if it exists
    const metadata = await getVersionMetadata('published')
    if (metadata) {
      const { versionName } = metadata
      await renameGraph({
        oldGraphName: 'published',
        newGraphName: versionName,
        transactionUrl
      })

      await updateVersionMetadata({
        graphId: versionName,
        versionType: 'past_published',
        transactionUrl
      })
    }

    // 2. Copy draft to published.
    await copyGraph({
      sourceGraphName: 'draft',
      targetGraphName: 'published',
      transactionUrl
    })

    // // 3. Updated published graph with version info.
    const updateDate = new Date().toISOString()
    await updateVersionMetadata({
      graphId: 'published',
      version: name,
      versionType: 'published',
      createdDate: updateDate,
      modifiedDate: updateDate,
      transactionUrl
    })

    // Commit the transaction
    await commitTransaction(transactionUrl)

    // Return success response
    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: `Publish process completed for version ${name}`,
        version: name,
        publishDate: updateDate
      })
    }
  } catch (error) {
    console.error('Error in publish process:', error)

    // Rollback the transaction if an error occurred
    if (transactionUrl) {
      await rollbackTransaction(transactionUrl)
    }

    // Return error response
    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Error in publish process',
        error: error.message
      })
    }
  }
}

export default publish
