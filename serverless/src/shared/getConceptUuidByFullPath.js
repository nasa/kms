import { createConceptResponseCacheKeyByFullPath } from './redisCacheKeys'
import { getCachedJsonResponse } from './redisCacheStore'

/**
 * Looks up a historical concept by full path using the KMS-664 Redis-backed cache.
 *
 * This helper is used when metadata-correction needs to answer:
 * "what historical concept did this old full-path keyword value refer to?"
 *
 * It looks up the normalized `{scheme, fullPath}` pair in the historical Redis cache and returns
 * the cached concept payload, which normally includes at least the concept UUID and full path.
 *
 * The input is normalized to lowercase before building the Redis key so lookups are stable even
 * when the caller's path casing differs from the cached CSV source.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.fullPath - Historical full-path value in the KMS-664 cache format.
 * @param {string} params.scheme - KMS scheme for the lookup.
 * @returns {Promise<{uuid: string, fullPath: string}|undefined>}
 * Cached historical concept payload when found, otherwise `undefined`.
 * @throws {Error} If the full path or scheme is missing.
 */
export const getConceptUuidByFullPath = async ({
  fullPath,
  scheme
}) => {
  if (!fullPath) {
    throw new Error('Missing full path for historical concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for historical concept lookup')
  }

  const cacheKey = createConceptResponseCacheKeyByFullPath({
    fullPath: fullPath.toLowerCase(),
    scheme: scheme.toLowerCase()
  })

  const cachedResponse = await getCachedJsonResponse({
    cacheKey,
    entityLabel: 'Historical Concept by fullPath'
  })

  if (!cachedResponse?.body) {
    return undefined
  }

  return JSON.parse(cachedResponse.body)
}

export default getConceptUuidByFullPath
