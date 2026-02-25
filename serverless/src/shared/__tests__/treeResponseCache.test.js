import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getRedisClient } from '@/shared/getRedisClient'
import { logger } from '@/shared/logger'
import {
  clearTreeResponseCache,
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

  describe('when clearing cached responses', () => {
    test('should clear tree cache keys by prefix', async () => {
      const del = vi.fn().mockResolvedValue(2)
      const scan = vi.fn().mockResolvedValue({
        cursor: '0',
        keys: [`${TREE_CACHE_KEY_PREFIX}:a`, `${TREE_CACHE_KEY_PREFIX}:b`]
      })
      getRedisClient.mockResolvedValue({
        scan,
        del
      })

      const deleted = await clearTreeResponseCache()

      expect(deleted).toBe(2)
      expect(del).toHaveBeenCalledWith([`${TREE_CACHE_KEY_PREFIX}:a`, `${TREE_CACHE_KEY_PREFIX}:b`])
    })

    test('should return zero when clearing tree cache and redis is unavailable', async () => {
      getRedisClient.mockResolvedValue(null)

      const deleted = await clearTreeResponseCache()

      expect(deleted).toBe(0)
    })

    test('should continue clearing tree cache until scan cursor reaches zero', async () => {
      const del = vi.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
      const scan = vi.fn()
        .mockResolvedValueOnce({
          cursor: '1',
          keys: [`${TREE_CACHE_KEY_PREFIX}:a`]
        })
        .mockResolvedValueOnce({
          cursor: '0',
          keys: [`${TREE_CACHE_KEY_PREFIX}:b`]
        })
      getRedisClient.mockResolvedValue({
        scan,
        del
      })

      const deleted = await clearTreeResponseCache()

      expect(deleted).toBe(2)
      expect(scan).toHaveBeenCalledTimes(2)
    })

    test('should stop clearing tree cache when scan cursor repeats to prevent loop', async () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
      const del = vi.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
      const scan = vi.fn()
        .mockResolvedValueOnce({
          cursor: '1',
          keys: [`${TREE_CACHE_KEY_PREFIX}:a`]
        })
        .mockResolvedValueOnce({
          cursor: '1',
          keys: [`${TREE_CACHE_KEY_PREFIX}:b`]
        })
      getRedisClient.mockResolvedValue({
        scan,
        del
      })

      const deleted = await clearTreeResponseCache()

      expect(deleted).toBe(2)
      expect(warnSpy).toHaveBeenCalledWith(
        '[cache-prime] clear-scan detected repeated cursor=1; stopping to prevent scan loop'
      )
    })
  })
})
