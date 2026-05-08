import { createPublishedConceptResponseCacheKeyByUuid } from './redisCacheKeys'
import { getCachedJsonResponse } from './redisCacheStore'

/**
 * Looks up a published concept by UUID using the Redis-backed published concept cache.
 *
 * This helper is used when metadata-correction already knows the concept UUID and needs the
 * current published concept payload for that UUID, especially the latest published full path.
 *
 * That makes it the published-cache counterpart to the historical lookup helpers: historical
 * lookups answer "what old concept was this?", while this helper answers "what is the current
 * published concept for that UUID now?".
 *
 * The cache key is built from the scheme plus UUID so schemes with different keyword namespaces
 * can safely reuse the same UUID lookup pattern without collisions.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.uuid - Published concept UUID.
 * @param {string} params.scheme - KMS scheme for the lookup.
 * @returns {Promise<{uuid: string, fullPath: string, longName?: string}|undefined>}
 * Cached published concept payload when found, otherwise `undefined`.
 * @throws {Error} If the UUID or scheme is missing.
 */
export const getPublishedConceptByUuid = async ({
  uuid,
  scheme
}) => {
  if (!uuid) {
    throw new Error('Missing uuid for published concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for published concept lookup')
  }

  const cacheKey = createPublishedConceptResponseCacheKeyByUuid({
    uuid,
    scheme: scheme.toLowerCase()
  })

  const cachedResponse = await getCachedJsonResponse({
    cacheKey,
    entityLabel: 'Published Concept by uuid'
  })

  if (!cachedResponse?.body) {
    return undefined
  }

  return JSON.parse(cachedResponse.body)
}

export default getPublishedConceptByUuid
