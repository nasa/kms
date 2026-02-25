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
