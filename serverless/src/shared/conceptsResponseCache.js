import { getRedisClient } from '@/shared/getRedisClient'
import { logger } from '@/shared/logger'

/** Prefix used for all concepts response cache keys in Redis. */
export const CACHE_KEY_PREFIX = 'kms:concepts'
/** Marker key that stores the currently primed published version signature. */
export const CACHE_VERSION_KEY = `${CACHE_KEY_PREFIX}:published:version`

const normalizeScheme = (scheme) => {
  if (!scheme) return ''

  if (scheme.toLowerCase() === 'granuledataformat') return 'dataformat'

  return scheme
}

const normalizeFormat = (format) => (format || 'rdf').toLowerCase()
const normalizePattern = (pattern) => (pattern || '').toLowerCase()
const normalizeEndpointPath = (endpointPath) => (endpointPath || '').toLowerCase()

/**
 * Builds a deterministic Redis key for a getConcepts response.
 *
 * @param {Object} params - Key dimensions.
 * @param {string} params.version - Requested keyword version.
 * @param {string} params.path - API resource/path identifier.
 * @param {string} [params.conceptScheme] - Concept scheme path parameter.
 * @param {string} [params.pattern] - Pattern path parameter.
 * @param {string} [params.endpointPath] - Resolved endpoint path (event.path).
 * @param {number} params.pageNum - Requested page number.
 * @param {number} params.pageSize - Requested page size.
 * @param {string} [params.format] - Requested response format.
 * @returns {string} Redis cache key.
 */
export const createConceptsResponseCacheKey = ({
  version,
  path,
  conceptScheme,
  pattern,
  endpointPath,
  pageNum,
  pageSize,
  format
}) => {
  const normalizedScheme = normalizeScheme(conceptScheme)
  const normalizedPattern = normalizePattern(pattern)
  const normalizedEndpointPath = normalizeEndpointPath(endpointPath)
  const normalizedFormat = normalizeFormat(format)

  return `${CACHE_KEY_PREFIX}:${version}:${path}:${normalizedEndpointPath}:${normalizedScheme}:${normalizedPattern}:${pageNum}:${pageSize}:${normalizedFormat}`
}

/**
 * Retrieves and deserializes a cached response for getConcepts.
 *
 * @param {string} cacheKey - Redis key.
 * @returns {Promise<Object|null>} Cached response object or null when not found/unavailable.
 */
export const getCachedConceptsResponse = async (cacheKey) => {
  const redisClient = await getRedisClient()

  if (!redisClient) return null

  const cachedString = await redisClient.get(cacheKey)

  if (!cachedString) return null

  try {
    return JSON.parse(cachedString)
  } catch (error) {
    logger.error(`Failed parsing cached response key=${cacheKey}, error=${error}`)

    return null
  }
}

/**
 * Stores a getConcepts response in Redis.
 *
 * @param {Object} params - Store parameters.
 * @param {string} params.cacheKey - Redis key.
 * @param {Object} params.response - Lambda response payload to cache.
 * @returns {Promise<void>}
 */
export const setCachedConceptsResponse = async ({
  cacheKey,
  response
}) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return

  await redisClient.set(cacheKey, JSON.stringify(response))
}

/**
 * Clears all concepts response cache keys under the configured prefix.
 *
 * Uses incremental SCAN + DEL to avoid blocking Redis with KEYS.
 *
 * @returns {Promise<number>} Number of keys deleted.
 */
export const clearConceptsResponseCache = async () => {
  const redisClient = await getRedisClient()
  if (!redisClient) return 0

  const seenCursors = new Set()
  const scanAndDelete = async (cursor = '0', deleted = 0) => {
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
      MATCH: `${CACHE_KEY_PREFIX}:*`,
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
