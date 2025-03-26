import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { renameGraph } from '@/shared/renameGraph'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

/**
 * Triggered by the publish process either directly (in offline mode) or via AWS Step Functions.
 *
 * This function is not called via curl, but is triggered by an internal process.
 * It performs the following steps:
 * 1. Validates the input to ensure a 'name' parameter is provided.
 * 2. If in offline mode, it calls the publish function directly.
 * 3. If not in offline mode, it triggers an AWS Step Function to handle the publish process.
 *
 * @param {Object} event - The event object containing the publish request details.
 * @param {string} event.body - A JSON string containing the publish parameters.
 * @param {string} event.body.name - The name of the version to be published.
 * @returns {Object} An object containing the status code, headers, and response body.
 *   The response varies based on whether the function is running in offline mode or not.
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
