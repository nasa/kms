import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getRedisClient } from '@/shared/getRedisClient'
import {
  createTreeResponseCacheKey,
  getCachedTreeResponse,
  setCachedTreeResponse,
  TREE_CACHE_KEY_PREFIX
} from '@/shared/treeResponseCache'

vi.mock('@/shared/getRedisClient')

describe('when using tree response cache', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getRedisClient.mockResolvedValue(null)
  })

  describe('when creating cache keys', () => {
    test('should include version, concept scheme, and filter', () => {
      const key = createTreeResponseCacheKey({
        version: 'published',
        conceptScheme: 'Earth Science',
        filter: 'water vapor'
      })

      expect(key).toBe(`${TREE_CACHE_KEY_PREFIX}:published:earth%20science:water%20vapor`)
    })

    test('should default version to published when not provided', () => {
      const key = createTreeResponseCacheKey({
        conceptScheme: 'all',
        filter: ''
      })

      expect(key).toBe(`${TREE_CACHE_KEY_PREFIX}:published:all:`)
    })
  })

  describe('when reading cached responses', () => {
    test('should return null when redis is not configured', async () => {
      const result = await getCachedTreeResponse('key')

      expect(result).toBeNull()
    })

    test('should return null when cache key is missing', async () => {
      getRedisClient.mockResolvedValue({
        get: vi.fn().mockResolvedValue(null)
      })

      const result = await getCachedTreeResponse('key')

      expect(result).toBeNull()
    })

    test('should parse and return cached response on cache hit', async () => {
      getRedisClient.mockResolvedValue({
        get: vi.fn().mockResolvedValue('{"statusCode":200}')
      })

      const result = await getCachedTreeResponse('key')

      expect(result).toEqual({ statusCode: 200 })
    })

    test('should return null when cached payload is invalid json', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      getRedisClient.mockResolvedValue({
        get: vi.fn().mockResolvedValue('{invalid')
      })

      const result = await getCachedTreeResponse('key')

      expect(result).toBeNull()
    })
  })

  describe('when writing cached responses', () => {
    test('should skip write when redis is not configured', async () => {
      await expect(setCachedTreeResponse({
        cacheKey: 'key',
        response: { statusCode: 200 }
      })).resolves.toBeUndefined()
    })

    test('should write serialized response to redis', async () => {
      const set = vi.fn().mockResolvedValue('OK')
      getRedisClient.mockResolvedValue({
        set
      })

      await setCachedTreeResponse({
        cacheKey: 'key',
        response: { statusCode: 200 }
      })

      expect(set).toHaveBeenCalledWith('key', '{"statusCode":200}')
    })
  })
})
