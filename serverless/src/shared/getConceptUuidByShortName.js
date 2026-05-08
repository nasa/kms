import { createConceptResponseCacheKeyByShortName } from './redisCacheKeys'
import { getCachedJsonResponse } from './redisCacheStore'

/**
 * Looks up a historical concept by short name using the KMS-664 Redis-backed cache.
 *
 * This helper is used when metadata-correction needs to answer:
 * "what historical concept did this old short-name keyword value refer to?"
 *
 * It looks up the normalized `{scheme, shortName}` pair in the historical Redis cache and returns
 * the cached concept payload, which normally includes at least the concept UUID and full path and
 * may also include a long name when the CSV source provided one.
 *
 * The input is normalized to lowercase before building the Redis key so lookups are stable even
 * when the caller's short-name casing differs from the cached CSV source.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.shortName - Historical short-name value.
 * @param {string} params.scheme - KMS scheme for the lookup.
 * @returns {Promise<{uuid: string, fullPath: string, longName?: string}|undefined>}
 * Cached historical concept payload when found, otherwise `undefined`.
 * @throws {Error} If the short name or scheme is missing.
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
