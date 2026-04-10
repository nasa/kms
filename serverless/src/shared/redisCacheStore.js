import { createClient } from 'redis'

import { logger } from '@/shared/logger'

let redisClientPromise
let hasLoggedRedisConfig = false

const { REDIS_ENABLED } = process.env
const { REDIS_HOST } = process.env
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379)

export const isRedisConfigured = () => (
  REDIS_ENABLED === 'true' && Boolean(REDIS_HOST) && Number.isInteger(REDIS_PORT)
)

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

      const client = createClient({
        socket: {
          host: REDIS_HOST,
          port: REDIS_PORT,
          connectTimeout: 5000,
          reconnectStrategy: () => false
        }
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
 * @param {Object} params - Read parameters.
 * @param {string} params.cacheKey - Redis key.
 * @param {string} params.entityLabel - Human-readable cache label for logs.
 * @param {string} [params.format] - Response format for cache logs.
 * @returns {Promise<Object|null>} Parsed response or null when unavailable/invalid.
 */
export const getCachedJsonResponse = async ({
  cacheKey,
  entityLabel,
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
    logger.debug(`[cache] skip-read version=draft ${logContext}`)

    return null
  }

  const redisClient = await getRedisClient()
  if (!redisClient) return null

  const cachedString = await redisClient.get(cacheKey)
  if (!cachedString) {
    logger.info(`[cache] miss ${logContext}`)

    return null
  }

  try {
    const parsedResponse = JSON.parse(cachedString)

    logger.info(`[cache] hit ${logContext}`)

    return parsedResponse
  } catch (error) {
    logger.error(`Failed parsing cached ${entityLabel} key=${cacheKey}, error=${error}`)

    return null
  }
}

/**
 * Writes a response payload to Redis as JSON.
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
