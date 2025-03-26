import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { renameGraph } from '@/shared/renameGraph'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

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
