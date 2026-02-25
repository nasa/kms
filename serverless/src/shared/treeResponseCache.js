import { getRedisClient } from '@/shared/getRedisClient'
import { logger } from '@/shared/logger'

export const TREE_CACHE_KEY_PREFIX = 'kms:tree'

const normalizeValue = (value) => (value ? encodeURIComponent(value.toLowerCase()) : '')

export const createTreeResponseCacheKey = ({
  version,
  conceptScheme,
  filter
}) => {
  const normalizedVersion = version || 'published'
  const normalizedScheme = normalizeValue(conceptScheme)
  const normalizedFilter = normalizeValue(filter)

  return `${TREE_CACHE_KEY_PREFIX}:${normalizedVersion}:${normalizedScheme}:${normalizedFilter}`
}

export const getCachedTreeResponse = async (cacheKey) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return null

  const cachedString = await redisClient.get(cacheKey)
  if (!cachedString) return null

  try {
    return JSON.parse(cachedString)
  } catch (error) {
    logger.error(`Failed parsing cached tree response key=${cacheKey}, error=${error}`)

    return null
  }
}

export const setCachedTreeResponse = async ({
  cacheKey,
  response
}) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return

  await redisClient.set(cacheKey, JSON.stringify(response))
}

/**
 * Clears all tree response cache keys under the configured prefix.
 *
 * Uses incremental SCAN + DEL to avoid blocking Redis with KEYS.
 *
 * @returns {Promise<number>} Number of keys deleted.
 */
export const clearTreeResponseCache = async () => {
  const redisClient = await getRedisClient()
  if (!redisClient) return 0

  const seenCursors = new Set()
  const scanAndDelete = async (cursor = '0', deleted = 0) => {
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
      MATCH: `${TREE_CACHE_KEY_PREFIX}:*`,
      COUNT: 500
    })

    const deletedCount = keys.length > 0 ? await redisClient.del(keys) : 0
    const nextDeleted = deleted + deletedCount
    const normalizedCursor = String(nextCursor)

    logger.debug(
      `[cache-prime] clear-scan cursor=${cursor} nextCursor=${normalizedCursor} keys=${keys.length} deletedBatch=${deletedCount} deletedTotal=${nextDeleted}`
    )

    if (seenCursors.has(normalizedCursor)) {
      logger.warn(
        `[cache-prime] clear-scan detected repeated cursor=${normalizedCursor}; stopping to prevent scan loop`
      )

      return nextDeleted
    }

    seenCursors.add(normalizedCursor)

    if (normalizedCursor === '0') return nextDeleted

    return scanAndDelete(normalizedCursor, nextDeleted)
  }

  return scanAndDelete()
}
