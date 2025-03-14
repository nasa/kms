import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getSkosConcept } from '@/shared/getSkosConcept'
import { toKeywordJson } from '@/shared/toKeywordJson'

const getKeyword = async (event) => {
  // Extract configuration and parameters
  const { defaultResponseHeaders } = getApplicationConfig()

  const { conceptId } = event.pathParameters

  try {
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

    const prefLabelMap = await createPrefLabelMap()
    const conceptSchemeMap = await createConceptSchemeMap()

    const result = await toKeywordJson(concept, conceptSchemeMap, prefLabelMap)

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
