import { createConceptResponseCacheKeyByShortName } from './redisCacheKeys'
import { getCachedJsonResponse } from './redisCacheStore'

/**
 * Looks up a historical concept by short name using the KMS-664 Redis-backed cache.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.shortName - Historical short-name value.
 * @param {string} params.scheme - KMS scheme for the lookup.
 * @returns {Promise<{uuid: string, fullPath: string, longName?: string}|undefined>} Cached historical concept payload.
 */
export const getConceptUuidByShortName = async ({
  shortName,
  scheme
}) => {
  if (!shortName) {
    throw new Error('Missing short name for historical concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for historical concept lookup')
  }

  const cacheKey = createConceptResponseCacheKeyByShortName({
    shortName: shortName.toLowerCase(),
    scheme: scheme.toLowerCase()
  })

  const cachedResponse = await getCachedJsonResponse({
    cacheKey,
    entityLabel: 'Historical Concept by shortName'
  })

  if (!cachedResponse?.body) {
    return undefined
  }

  return JSON.parse(cachedResponse.body)
}

export default getConceptUuidByShortName
