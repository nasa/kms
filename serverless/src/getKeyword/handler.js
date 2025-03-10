import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSkosConcept } from '@/shared/getSkosConcept'
import { toKeywordJson } from '@/shared/toKeywordJson'

const getKeyword = async (event) => {
  // Extract configuration and parameters
  const { defaultResponseHeaders } = getApplicationConfig()

  // Check if pathParameters exists
  if (!event.pathParameters) {
    console.error('Missing pathParameters')

    return {
      headers: defaultResponseHeaders,
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing required parameters'
      })
    }
  }

  const { conceptId } = event.pathParameters

  if (!conceptId) {
    console.error('Missing conceptId parameter')

    return {
      headers: defaultResponseHeaders,
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing conceptId parameter'
      })
    }
  }

  const concept = await getSkosConcept({
    conceptIRI: `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`
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
        error: 'Keyword not found'
      })
    }
  }

  console.log('concept=', concept)

  const prefLabelMap = await createPrefLabelMap()
  const result = await toKeywordJson(concept, prefLabelMap)

  try {
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
