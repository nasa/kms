import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { renameGraph } from '@/shared/renameGraph'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

/**
 * Performs the publication process for a new version of the keyword set.
 *
 * This function is invoked asynchronously by the triggerPublish Lambda function.
 * It is not called directly via HTTP requests, but rather as part of an internal process.
 *
 * The function performs the following steps:
 * 1. Validates the input to ensure a 'name' parameter is provided.
 * 2. If a 'published' version exists, it is moved to 'past_published'.
 * 3. The 'draft' version is copied to become the new 'published' version.
 * 4. Metadata for the new 'published' version is updated with the provided name and timestamp.
 *
 * @async
 * @function publish
 * @param {Object} event - The event object passed from the triggering Lambda function.
 * @param {string} event.name - The name of the version to be published.
 * @returns {Promise<Object>} A promise that resolves to an object containing the status code, headers, and response body.
 * @property {number} statusCode - The HTTP status code (200 for success, 400 for bad request, 500 for server error).
 * @property {Object} headers - The response headers, including CORS and content type settings.
 * @property {string} body - A JSON string containing the response message, version name, and publish date (for success) or error details (for failure).
 *
 * @throws {Error} If there's an issue with renaming graphs, copying data, or updating metadata.
 *
 * @example
 * // Successful invocation
 * const event = { name: 'v1.0.0' };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 200,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Publish process completed for version v1.0.0","version":"v1.0.0","publishDate":"2023-06-01T12:00:00.000Z"}'
 * // }
 *
 * @example
 * // Failed invocation (missing name)
 * const event = {};
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 400,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Error: \\"name\\" parameter is required in the request body"}'
 * // }
 */
export const publish = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  const name = event.name || (event.body ? JSON.parse(event.body).name : null)

  // Check if name is provided
  if (!name) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error: "name" parameter is required in the request body' })
    }
  }

  try {
    // 1. Move published to past_published if it exists
    const metadata = await getVersionMetadata('published')
    if (metadata) {
      const { versionName } = metadata
      await renameGraph({
        oldGraphName: 'published',
        newGraphName: versionName
      })

      await updateVersionMetadata({
        graphId: versionName,
        versionType: 'past_published'
      })
    }

    // 2. Copy draft to published.
    await copyGraph({
      sourceGraphName: 'draft',
      targetGraphName: 'published'
    })

    // 3. Updated published graph with version info.
    const updateDate = new Date().toISOString()
    await updateVersionMetadata({
      graphId: 'published',
      version: name,
      versionType: 'published',
      createdDate: updateDate,
      modifiedDate: updateDate
    })

    console.log(`Published draft to ${name} successfully`)

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
