import { DEFAULT_SHORT_NAME_SCHEMES } from '@/shared/constants/shortNameForUuidSchemes'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { createConceptResponseCacheKeyByShortName } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

/**
 * Retrieves a cached UUID and fullPath for a given shortName. This handler ONLY checks the cache
 * and will return a 404 if the value is not already cached.
 *
 * @async
 * @function getCachedConceptByShortName
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
 * // with UUID '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d' and fullPath 'Air-based Platforms > Propeller > AC-690A', the handler returns:
 * const response = {
 *   statusCode: 200,
 *   headers: {
 *     'Content-Type': 'application/json'
 *   },
 *   body: '{\"uuid\":\"6fa682b9-c6b5-46ca-971f-b7ecd4bf304d\",\"fullPath\":\"Air-based Platforms > Propeller > AC-690A\"}'
 * };
 */
export const getCachedConceptByShortName = async (event, context) => {
  const {
    defaultResponseHeaders,
    schemesForUuidByShortName: schemesFromConfig
  } = getApplicationConfig()

  const sourceForSchemes = (schemesFromConfig && schemesFromConfig.length > 0)
    ? schemesFromConfig
    : DEFAULT_SHORT_NAME_SCHEMES
  const schemesForUuidByShortName = sourceForSchemes.map((s) => s.toLowerCase())

  logger.debug(`Using schemes for shortName cache: ${JSON.stringify(schemesForUuidByShortName)}`)

  logAnalyticsData({
    event,
    context
  })

  const { pathParameters, queryStringParameters } = event
  const { shortName } = pathParameters || {}
  const { scheme: rawScheme } = queryStringParameters || {}
  const scheme = rawScheme?.toLowerCase()

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

  if (!schemesForUuidByShortName.includes(scheme)) {
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
      entityLabel: 'Concept by shortName'
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

export default getCachedConceptByShortName
