import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSkosConcept } from '@/shared/getSkosConcept'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { toKeywordJson } from '@/shared/toKeywordJson'

export const getKeyword = async (event, context) => {
  // Extract configuration and parameters
  const { defaultResponseHeaders } = getApplicationConfig()
  const queryStringParameters = event.queryStringParameters || {}
  const version = queryStringParameters?.version || 'published'
  const { conceptId } = event.pathParameters

  logAnalyticsData({
    event,
    context
  })

  try {
    const concept = await getSkosConcept({
      conceptIRI: `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`,
      version
    })

    // Check if concept is null and return 404 if so
    if (concept === null) {
      return {
        statusCode: 404,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: `Keyword not found for uuid=${conceptId}`
        })
      }
    }

    const prefLabelMap = await createPrefLabelMap(version)

    const result = await toKeywordJson(
      concept,
      prefLabelMap
    )

    return {
      statusCode: 200,
      body: JSON.stringify(result, null, 2),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error(`Error retrieving Keyword, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getKeyword
