import { createPublishedConceptResponseCacheKeyByUuid } from './redisCacheKeys'
import { getCachedJsonResponse } from './redisCacheStore'

/**
 * Looks up a published concept by UUID using the Redis-backed published concept cache.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.uuid - Published concept UUID.
 * @param {string} params.scheme - KMS scheme for the lookup.
 * @returns {Promise<{uuid: string, fullPath: string, longName?: string}|undefined>} Cached published concept payload.
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
