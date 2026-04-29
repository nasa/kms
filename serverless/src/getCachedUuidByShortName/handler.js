import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { createUuidResponseCacheKeyByShortName } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

/**
 * Retrieves a cached UUID for a given shortName. This handler ONLY checks the cache
 * and will return a 404 if the UUID is not already cached.
 *
 * @async
 * @function getCachedUuidByShortName
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} event.pathParameters.shortName - The short name of the concept.
 * @returns {Promise<Object>} A promise that resolves to a standard Lambda response object.
 */
export const getCachedUuidByShortName = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  const { pathParameters } = event
  const { shortName } = pathParameters || {}

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

  try {
    const cacheKey = createUuidResponseCacheKeyByShortName({
      shortName
    })

    const cachedResponse = await getCachedJsonResponse({
      cacheKey,
      entityLabel: 'UUID by shortName'
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
      body: JSON.stringify({ error: 'UUID not found for the given shortName' })
    }
  } catch (error) {
    logger.error(`Error retrieving cached UUID, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getCachedUuidByShortName
