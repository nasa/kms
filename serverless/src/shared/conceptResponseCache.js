import { getRedisClient } from '@/shared/getRedisClient'
import { logger } from '@/shared/logger'

export const CONCEPT_CACHE_KEY_PREFIX = 'kms:concept'

const normalizeFormat = (format) => (format || 'rdf').toLowerCase()
const normalizePath = (path) => (path || '').toLowerCase()
const normalizeValue = (value) => (value ? encodeURIComponent(value) : '')

export const createConceptResponseCacheKey = ({
  version,
  path,
  endpointPath,
  format,
  conceptId,
  shortName,
  altLabel,
  fullPath,
  scheme
}) => {
  const normalizedVersion = version || 'published'
  const normalizedResourcePath = normalizePath(path)
  const normalizedEndpointPath = normalizePath(endpointPath)
  const normalizedFormat = normalizeFormat(format)
  const normalizedConceptId = normalizeValue(conceptId)
  const normalizedShortName = normalizeValue(shortName)
  const normalizedAltLabel = normalizeValue(altLabel)
  const normalizedFullPath = normalizeValue(fullPath)
  const normalizedScheme = normalizeValue(scheme)

  return `${CONCEPT_CACHE_KEY_PREFIX}:${normalizedVersion}:${normalizedResourcePath}:${normalizedEndpointPath}:${normalizedFormat}:${normalizedConceptId}:${normalizedShortName}:${normalizedAltLabel}:${normalizedFullPath}:${normalizedScheme}`
}

export const getCachedConceptResponse = async (cacheKey) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return null

  const cachedString = await redisClient.get(cacheKey)
  if (!cachedString) return null

  try {
    return JSON.parse(cachedString)
  } catch (error) {
    logger.error(`Failed parsing cached concept response key=${cacheKey}, error=${error}`)

    return null
  }
}

export const setCachedConceptResponse = async ({
  cacheKey,
  response
}) => {
  const redisClient = await getRedisClient()
  if (!redisClient) return

  await redisClient.set(cacheKey, JSON.stringify(response))
}

/**
 * Clears all concept response cache keys under the configured prefix.
 *
 * Uses incremental SCAN + DEL to avoid blocking Redis with KEYS.
 *
 * @returns {Promise<number>} Number of keys deleted.
 */
export const clearConceptResponseCache = async () => {
  const redisClient = await getRedisClient()
  if (!redisClient) return 0

  const seenCursors = new Set()
  const scanAndDelete = async (cursor = '0', deleted = 0) => {
    const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
      MATCH: `${CONCEPT_CACHE_KEY_PREFIX}:*`,
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
