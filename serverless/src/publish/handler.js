import { createVersionMetadata } from '@/shared/createVersionMetadata'
import { deleteVersionMetadata } from '@/shared/deleteVersionMetadata'
import { findPublishedVersion } from '@/shared/findPublishedVersion'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sparqlRequest } from '@/shared/sparqlRequest'

export const publish = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { queryStringParameters } = event
  const { name } = queryStringParameters

  try {
    // 1. Fetch RDF data from the 'draft' graph
    const getDraftResponse = await sparqlRequest({
      method: 'GET',
      path: '/statements',
      accept: 'application/rdf+xml',
      version: 'draft'
    })

    const draftRdfData = await getDraftResponse.text()

    // 2. Find the currently published version and change its type to 'past_published'
    const publishedGraph = await findPublishedVersion()
    console.log('pg=', publishedGraph)

    if (publishedGraph) {
      const publishedVersion = publishedGraph.split('/').pop()
      console.log('pv=', publishedVersion)
      const publishedMetadata = await getVersionMetadata(publishedVersion)
      await deleteVersionMetadata(publishedVersion)
      console.log('pm=', publishedMetadata)
      await createVersionMetadata({
        version: publishedVersion,
        versionType: 'past_published',
        createdDate: publishedMetadata.created,
        modifiedDate: publishedMetadata.modified
      })
    }

    // 3. Create a new graph with the specified name and set it as published
    await sparqlRequest({
      method: 'PUT',
      path: '/statements',
      accept: 'application/rdf+xml',
      version: name,
      body: draftRdfData
    })

    // 4. Now mark the new version we just created as published.
    const updateDate = new Date().toISOString()

    await deleteVersionMetadata(name)
    await createVersionMetadata({
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
