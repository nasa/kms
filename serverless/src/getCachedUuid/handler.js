import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { createUuidResponseCacheKey } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

/**
 * Retrieves a cached UUID for a given fullPath. This handler ONLY checks the cache
 * and will return a 404 if the UUID is not already cached.
 *
 * @async
 * @function getCachedUuid
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
 *   body: '{\"uuid\":\"91697b7d-8f2b-4954-850e-61d5f61c867d\"}'
 * };
 */
export const getCachedUuid = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  const { pathParameters } = event
  const { fullPath } = pathParameters || {}

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

  try {
    const decode = (str) => decodeURIComponent(str.replace(/\+/g, ' '))
    const decodedFullPath = decode(fullPath)

    const cacheKey = createUuidResponseCacheKey({
      fullPath: decodedFullPath
    })

    const cachedResponse = await getCachedJsonResponse({
      cacheKey,
      entityLabel: 'uuid by fullPath'
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
      body: JSON.stringify({ error: 'UUID not found for the given fullPath' })
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

export default getCachedUuid
