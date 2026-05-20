import {
  HISTORICAL_CONCEPT_FULL_PATH_SCHEMES
} from '@/shared/constants/fullPathForHistoricalConceptSchemes'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { createConceptResponseCacheKeyByFullPath } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

/**
 * Retrieves a historical concept (UUID and fullPath) for a given fullPath from the cache. This handler ONLY checks the cache
 * and will return a 404 if the value is not already cached.
 *
 * @async
 * @function getHistoricalConceptByFullPath
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} event.pathParameters.fullPath - The full path of the concept.
 * @returns {Promise<Object>} A promise that resolves to a standard Lambda response object.
 * @example
 * // Example event from API Gateway
 * const event = {
 *   pathParameters: {
 *     fullPath: 'EARTH+SCIENCE+%3E+OCEANS'
 *   }
 * };
 *
 * // Assuming the cache is populated for the fullPath 'EARTH SCIENCE > OCEANS'
 * // with UUID '91697b7d-8f2b-4954-850e-61d5f61c867d', the handler returns:
 * const response = {
 *   statusCode: 200,
 *   headers: {
 *     'Content-Type': 'application/json'
 *   },
 *   body: '{\"uuid\":\"91697b7d-8f2b-4954-850e-61d5f61c867d\",\"fullPath\":\"EARTH SCIENCE > OCEANS\"}'
 * };
 */
export const getHistoricalConceptByFullPath = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  const schemesForHistoricalConceptByFullPath = HISTORICAL_CONCEPT_FULL_PATH_SCHEMES.map(
    (s) => s.toLowerCase()
  )

  logAnalyticsData({
    event,
    context
  })

  const { pathParameters, queryStringParameters } = event
  const { fullPath } = pathParameters || {}
  const {
    scheme: rawScheme,
    bypassCache: bypassCacheFlag
  } = queryStringParameters || {}
  const scheme = rawScheme?.toLowerCase()
  const bypassCache = bypassCacheFlag === 'true'

  if (!fullPath) {
    return {
      statusCode: 400,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'fullPath is required' })
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

  if (!schemesForHistoricalConceptByFullPath.includes(scheme)) {
    return {
      statusCode: 400,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: `Caching by fullPath is not supported for the '${rawScheme}' scheme` })
    }
  }

  try {
    const decode = (str) => decodeURIComponent(str.replace(/\+/g, ' '))
    const decodedFullPath = decode(fullPath).toLowerCase()

    const cacheKey = createConceptResponseCacheKeyByFullPath({
      fullPath: decodedFullPath,
      scheme
    })

    const cachedResponse = await getCachedJsonResponse({
      cacheKey,
      entityLabel: 'Historical Concept by fullPath',
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
      body: JSON.stringify({ error: 'Cached Concept not found for the given fullPath' })
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

export default getHistoricalConceptByFullPath
