import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { renameGraph } from '@/shared/renameGraph'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

/**
 * Publishes the draft version of the keyword management system (KMS) to a new published version.
 *
 * This function performs the following steps in the publishing process:
 * 1. If a published version exists:
 *    a. Renames the current 'published' graph to its version name (e.g., '9.1.5').
 *    b. Updates the metadata of this graph to mark it as 'past_published'.
 * 2. Copies the 'draft' graph to a new 'published' graph.
 * 3. Updates the metadata of the new 'published' graph with the new version information.
 *
 * @async
 * @function publish
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.queryStringParameters - The query string parameters from the HTTP request.
 * @param {string} event.queryStringParameters.name - The name of the new version to be published (e.g., '9.1.6').
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   @property {number} statusCode - HTTP status code (200 for success, 400 for bad request, 500 for server error).
 *   @property {Object} headers - Response headers.
 *   @property {string} body - JSON stringified response body containing a success or error message.
 *
 * @throws Will not throw errors directly, but will catch and return them in the response object.
 *
 * @example
 * // Example event object
 * const event = {
 *   queryStringParameters: {
 *     name: '9.1.6'
 *   }
 * };
 *
 * // Example usage
 * const response = await publish(event);
 * console.log(response);
 * // On success:
 * // {
 * //   statusCode: 200,
 * //   headers: { ... },
 * //   body: '{"message":"Published draft to 9.1.6 successfully"}'
 * // }
 *
 * // On error (e.g., missing name parameter):
 * // {
 * //   statusCode: 400,
 * //   headers: { ... },
 * //   body: '{"message":"Error: \"name\" parameter is required"}'
 * // }
 *
 * @see Related functions:
 * {@link getVersionMetadata}
 * {@link renameGraph}
 * {@link updateVersionMetadata}
 * {@link copyGraph}
 */
export const publish = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { queryStringParameters } = event
  const { name } = queryStringParameters

  // Check if name is provided
  if (!name) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error: "name" parameter is required' })
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

    // 3. Updated published graphwith version info.
    const updateDate = new Date().toISOString()
    await updateVersionMetadata({
      graphId: 'published',
      version: name,
      versionType: 'published',
      createdDate: updateDate,
      modifiedDate: updateDate
    })

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: `Published draft to ${name} successfully`
      })
    }
  } catch (error) {
    console.error('Error publishing data:', error)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: `Error publishing draft to ${name}` })
    }
  }
}

export default publish
