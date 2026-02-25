import { getRedisClient } from '@/shared/getRedisClient'

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
    console.error(`Failed parsing cached tree response key=${cacheKey}, error=${error}`)

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
