import { createClient } from 'redis'

import { logger } from '@/shared/logger'

/**
 * Shared Redis connection and cache I/O helpers for KMS.
 *
 * This module owns the process-level Redis client lifecycle plus the small helper functions KMS
 * uses to read, write, and clear cached JSON responses. It is intentionally shared so the API
 * cache, published keyword cache, historical keyword cache, and metadata-correction helpers all
 * use the same Redis configuration and logging behavior.
 *
 * The runtime behavior is:
 * - if Redis is not configured, callers get a safe `null` client / no-op cache behavior
 * - if Redis is configured, one lazily created shared client is reused within the process
 * - cache helpers serialize and parse JSON response payloads consistently across features
 */

let redisClientPromise
let hasLoggedRedisConfig = false

const { REDIS_ENABLED } = process.env
const { REDIS_HOST } = process.env
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)
const REDIS_FAIL_FAST = process.env.REDIS_FAIL_FAST === 'true'

/**
 * Reports whether Redis caching is configured for the current process.
 *
 * @returns {boolean} `true` when Redis is enabled and has a usable host/port configuration.
 */
export const isRedisConfigured = () => (
  REDIS_ENABLED === 'true' && Boolean(REDIS_HOST) && Number.isInteger(REDIS_PORT)
)

/**
 * Gets or creates the shared Redis client connection for the current process.
 *
 * The client is created lazily on first use and cached as a promise so concurrent callers share
 * the same connection attempt. When Redis is unavailable or not configured, this resolves to
 * `null` so higher-level cache helpers can safely fall back to no-op behavior.
 *
 * @returns {Promise<import('redis').RedisClientType|null>} Connected Redis client or `null`.
 */
export const getRedisClient = async () => {
  if (!isRedisConfigured()) {
    if (!hasLoggedRedisConfig) {
      hasLoggedRedisConfig = true
      logger.info(`Redis disabled or not configured: REDIS_ENABLED=${REDIS_ENABLED}, REDIS_HOST=${REDIS_HOST}, REDIS_PORT=${REDIS_PORT}`)
    }

    return null
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      if (!hasLoggedRedisConfig) {
        hasLoggedRedisConfig = true
        logger.info(`Redis configured: host=${REDIS_HOST}, port=${REDIS_PORT}`)
      }

      const socket = {
        host: REDIS_HOST,
        port: REDIS_PORT
      }

      if (REDIS_FAIL_FAST) {
        socket.connectTimeout = 5000
        socket.reconnectStrategy = () => false
      }

      const client = createClient({
        socket
      })

      client.on('error', (error) => {
        logger.error(`Redis client error: ${error}`)
      })

      await client.connect()
      logger.info('Redis connected')

      return client
    })().catch((error) => {
      redisClientPromise = null
      logger.error(`Redis connect failed: ${error}`)

      return null
    })
  }

  return redisClientPromise
}

/**
 * Resets module-level Redis client state for tests.
 *
 * This is only intended for test isolation so each test can control connection/logging state
 * without reusing a previous test's cached client promise.
 *
 * @returns {void}
 */
export const resetRedisClientStateForTests = () => {
  redisClientPromise = null
  hasLoggedRedisConfig = false
}

const parseCacheKey = (cacheKey) => {
  const [namespace, cacheType, version] = cacheKey.split(':', 4)

  return {
    namespace,
    cacheType,
    version
  }
}

const buildCacheLogContext = ({
  cacheKey,
  endpoint,
  format
}) => {
  const context = [`key=${cacheKey}`]

  if (format) {
    context.unshift(`format=${String(format).toLowerCase()}`)
  }

  if (endpoint) {
    context.unshift(`endpoint=${endpoint}`)
  }

  return context.join(' ')
}

/**
 * Reads and parses a cached JSON response by key.
 *
 * Draft-version keys are intentionally skipped because draft reads should not participate in the
 * shared published cache namespace.
 *
 * @param {Object} params - Read parameters.
 * @param {string} params.cacheKey - Redis key.
 * @param {string} params.entityLabel - Human-readable cache label for logs.
 * @param {string} [params.format] - Response format for cache logs.
 * @param {boolean} [params.bypassCache=false] - When `true`, skips the Redis read intentionally
 *   and returns `null` so the caller can force a fresh source-of-truth read.
 * @returns {Promise<Object|null>} Parsed cached response, or `null` when absent, skipped, or invalid.
 */
export const getCachedJsonResponse = async ({
  cacheKey,
  entityLabel,
  format,
  bypassCache = false
}) => {
  const { namespace, cacheType, version } = parseCacheKey(cacheKey)
  const endpoint = namespace && cacheType ? `${namespace}:${cacheType}` : null
  const logContext = buildCacheLogContext({
    cacheKey,
    endpoint,
    format
  })

  if (bypassCache) {
    logger.debug(`[cache] bypass-read ${logContext}`)

    return null
  }

  if (version === 'draft') {
    logger.debug(`[cache] skip-read version=draft ${logContext}`)

    return null
  }

  const redisClient = await getRedisClient()
  if (!redisClient) return null

  const cachedString = await redisClient.get(cacheKey)
  if (!cachedString) {
    logger.debug(`[cache] miss ${logContext}`)

    return null
  }

  try {
    const parsedResponse = JSON.parse(cachedString)

    logger.debug(`[cache] hit ${logContext}`)

    return parsedResponse
  } catch (error) {
    logger.error(`Failed parsing cached ${entityLabel} key=${cacheKey}, error=${error}`)

    return null
  }
}

/**
 * Writes a response payload to Redis as JSON.
 *
 * Draft-version keys are intentionally skipped because draft responses should not populate the
 * shared published cache namespace.
 *
 * @param {Object} params - Write parameters.
 * @param {string} params.cacheKey - Redis key.
 * @param {Object} params.response - Lambda response payload.
 * @param {string} [params.format] - Response format for cache logs.
 * @returns {Promise<void>}
 */
export const setCachedJsonResponse = async ({
  cacheKey,
  response,
  format
}) => {
  const { namespace, cacheType, version } = parseCacheKey(cacheKey)
  const endpoint = namespace && cacheType ? `${namespace}:${cacheType}` : null
  const logContext = buildCacheLogContext({
    cacheKey,
    endpoint,
    format
  })

  if (version === 'draft') {
    logger.debug(`[cache] skip-write version=draft ${logContext}`)

    return
  }

  const redisClient = await getRedisClient()
  if (!redisClient) return

  await redisClient.set(cacheKey, JSON.stringify(response))
  logger.debug(`[cache] write ${logContext}`)
}

/**
 * Clears cache keys by prefix using SCAN + DEL.
 *
 * This is used by cache-prime flows that need to clear a namespace without blocking on a single
 * giant `KEYS` call. The helper scans in batches and tracks cursors defensively to avoid an
 * accidental infinite scan loop.
 *
 * @param {Object} params - Clear parameters.
 * @param {string} params.keyPrefix - Prefix pattern without trailing wildcard.
 * @returns {Promise<number>} Number of keys deleted.
 */
export const clearCachedByPrefix = async ({
  keyPrefix
}) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return 0

  const seenCursors = new Set()
  const scanAndDelete = async (cursor = '0', deleted = 0) => {
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
      MATCH: `${keyPrefix}:*`,
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
