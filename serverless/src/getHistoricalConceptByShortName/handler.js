import {
  HISTORICAL_CONCEPT_SHORT_NAME_SCHEMES
} from '@/shared/constants/shortNameForHistoricalConceptSchemes'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { createConceptResponseCacheKeyByShortName } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

/**
 * Retrieves a historical concept (UUID, fullPath, and longName) for a given shortName from the cache. This handler ONLY checks the cache
 * and will return a 404 if the value is not already cached.
 *
 * @async
 * @function getHistoricalConceptByShortName
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} event.pathParameters.shortName - The short name of the concept.
 * @returns {Promise<Object>} A promise that resolves to a standard Lambda response object.
 * @example
 * // Example event from API Gateway
 * const event = {
 *   pathParameters: {
 *     shortName: 'AC-690A'
 *   },
 *   queryStringParameters: {
 *     scheme: 'instruments'
 *   }
 * };
 *
 * // Assuming the cache is populated for the shortName 'AC-690A'
 * // with UUID '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d', fullPath 'Air-based Platforms > Propeller > AC-690A',
 * // and longName 'Aerocommander aircraft', the handler returns:
 * const response = {
 *   statusCode: 200,
 *   headers: {
 *     'Content-Type': 'application/json'
 *   },
 *   body: '{\"uuid\":\"6fa682b9-c6b5-46ca-971f-b7ecd4bf304d\",\"fullPath\":\"Air-based Platforms > Propeller > AC-690A\",\"longName\":\"Aerocommander aircraft\"}'
 * };
 */
export const getHistoricalConceptByShortName = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  const schemesForHistoricalConceptByShortName = HISTORICAL_CONCEPT_SHORT_NAME_SCHEMES.map(
    (s) => s.toLowerCase()
  )

  logAnalyticsData({
    event,
    context
  })

  const { pathParameters, queryStringParameters } = event
  const { shortName } = pathParameters || {}
  const {
    scheme: rawScheme,
    bypassCache: bypassCacheFlag
  } = queryStringParameters || {}
  const scheme = rawScheme?.toLowerCase()
  const bypassCache = bypassCacheFlag === 'true'

  if (!shortName) {
    return {
      statusCode: 400,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'shortName is required' })
    }
  }

  if (!scheme) {
    return {
      statusCode: 400,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'scheme is required' })
    }
  }

  if (!schemesForHistoricalConceptByShortName.includes(scheme)) {
    return {
      statusCode: 400,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: `Caching by shortName is not supported for the '${rawScheme}' scheme` })
    }
  }

  try {
    const decode = (str) => decodeURIComponent(str.replace(/\+/g, ' '))
    const decodedShortName = decode(shortName).toLowerCase()

    const cacheKey = createConceptResponseCacheKeyByShortName({
      shortName: decodedShortName,
      scheme
    })

    const cachedResponse = await getCachedJsonResponse({
      cacheKey,
      entityLabel: 'Historical Concept by shortName',
      bypassCache
    })

    if (cachedResponse) {
      // Return the entire cached response, which is already in the correct format.
      return cachedResponse
    }

    // If not in cache, we cannot proceed because this handler's job is only to check the cache.
    return {
      statusCode: 404,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Cached Concept not found for the given shortName' })
    }
  } catch (error) {
    logger.error(`Error retrieving historical concept, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getHistoricalConceptByShortName
