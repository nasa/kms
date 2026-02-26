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
          port: REDIS_PORT
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

/**
 * Reads and parses a cached JSON response by key.
 *
 * @param {Object} params - Read parameters.
 * @param {string} params.cacheKey - Redis key.
 * @param {string} params.entityLabel - Human-readable cache label for logs.
 * @returns {Promise<Object|null>} Parsed response or null when unavailable/invalid.
 */
export const getCachedJsonResponse = async ({
  cacheKey,
  entityLabel
}) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return null

  const cachedString = await redisClient.get(cacheKey)
  if (!cachedString) return null

  try {
    return JSON.parse(cachedString)
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
 * @returns {Promise<void>}
 */
export const setCachedJsonResponse = async ({
  cacheKey,
  response
}) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return

  await redisClient.set(cacheKey, JSON.stringify(response))
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
