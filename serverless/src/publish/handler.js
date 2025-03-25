import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { renameGraph } from '@/shared/renameGraph'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

/**
 * Publishes the draft version of the keyword management system (KMS) to a new published version.
 *
 * This function can only be triggered by an HTTP POST request.
 * It initiates the publishing process asynchronously and returns immediately.
 *
 * @async
 * @function publish
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - JSON string containing the request body.
 * @param {string} event.body.name - The name of the new version to be published (e.g., '9.1.6').
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   @property {number} statusCode - HTTP status code (202 for accepted, 400 for bad request).
 *   @property {Object} headers - Response headers.
 *   @property {string} body - JSON stringified response body containing a success or error message.
 *
 * @throws Will not throw errors directly, but will catch and return them in the response object.
 *
 * @example
 * // Example usage
 * const event = {
 *   body: JSON.stringify({
 *     name: '9.1.6'
 *   })
 * };
 * const response = await publish(event);
 * console.log(response);
 * // {
 * //   statusCode: 202,
 * //   headers: { ... },
 * //   body: '{"message":"Publish process initiated for version 9.1.6"}'
 * // }
 *
 * @example
 * curl -X POST https://your-api-endpoint.com/publish \
 *   -H "Content-Type: application/json" \
 *   -d '{"name": "9.1.6"}'
 *
 * // Response:
 * // {
 * //   "statusCode": 202,
 * //   "headers": {
 * //     "Content-Type": "application/json",
 * //     "Access-Control-Allow-Origin": "*"
 * //   },
 * //   "body": "{\"message\":\"Publish process initiated for version 9.1.6\"}"
 * // }
 */
export const publish = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  const { body } = event
  const { name } = body

  // Check if name is provided
  if (!name) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error: "name" parameter is required in the request body' })
    }
  }

  async function publishProcess() {
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
  }

  // Start the publish process asynchronously
  publishProcess().catch((error) => {
    console.error('Error in publish process:', error)
  })

  // Return immediately
  return {
    statusCode: 202,
    headers: defaultResponseHeaders,
    body: JSON.stringify({ message: `Publish process initiated for version ${name}` })
  }
}

export default publish
