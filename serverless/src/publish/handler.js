import { copyGraph } from '@/shared/copyGraph'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { renameGraph } from '@/shared/renameGraph'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

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
      if (versionName) {
        await renameGraph({
          oldGraphName: 'published',
          newGraphName: versionName
        })

        await updateVersionMetadata({
          graphId: versionName,
          versionType: 'past_published'
        })
      } else {
        console.warn('No versionName found in published metadata, skipping rename and update')
      }
    } else {
      console.log('No published version exists yet')
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
