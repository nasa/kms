import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  CACHE_KEY_PREFIX,
  clearConceptsResponseCache,
  createConceptsResponseCacheKey,
  getCachedConceptsResponse,
  setCachedConceptsResponse
} from '@/shared/conceptsResponseCache'
import { getRedisClient } from '@/shared/getRedisClient'

vi.mock('@/shared/getRedisClient')

describe('conceptsResponseCache', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getRedisClient.mockResolvedValue(null)
  })

  describe('when building cache keys', () => {
    test('normalizes granuledataformat scheme to dataformat', () => {
      const key = createConceptsResponseCacheKey({
        version: 'published',
        path: '/concepts/concept_scheme/{conceptScheme}',
        endpointPath: '/concepts/concept_scheme/granuledataformat',
        conceptScheme: 'granuledataformat',
        pattern: '',
        pageNum: 1,
        pageSize: 2000,
        format: 'RDF'
      })

      expect(key).toContain(':/concepts/concept_scheme/granuledataformat:dataformat::1:2000:rdf')
    })

    test('keeps non-special scheme unchanged in cache key', () => {
      const key = createConceptsResponseCacheKey({
        version: 'published',
        path: '/concepts/concept_scheme/{conceptScheme}',
        endpointPath: '/concepts/concept_scheme/platforms',
        conceptScheme: 'platforms',
        pattern: '',
        pageNum: 1,
        pageSize: 2000,
        format: 'rdf'
      })

      expect(key).toContain(':platforms::1:2000:rdf')
    })

    test('defaults format to rdf when format is not provided', () => {
      const key = createConceptsResponseCacheKey({
        version: 'published',
        path: '/concepts',
        endpointPath: '/concepts',
        conceptScheme: '',
        pattern: '',
        pageNum: 1,
        pageSize: 10
      })

      expect(key).toContain(':rdf')
    })

    test('includes normalized pattern in cache key', () => {
      const key = createConceptsResponseCacheKey({
        version: 'published',
        path: '/concepts/pattern/{pattern}',
        endpointPath: '/concepts/pattern/WATER',
        conceptScheme: '',
        pattern: 'WATER',
        pageNum: 1,
        pageSize: 2000,
        format: 'json'
      })

      expect(key).toContain('/concepts/pattern/{pattern}:/concepts/pattern/water::water:1:2000:json')
    })

    test('includes version in key to avoid draft/published collisions', () => {
      const publishedKey = createConceptsResponseCacheKey({
        version: 'published',
        path: '/concepts',
        endpointPath: '/concepts',
        pageNum: 1,
        pageSize: 2000,
        format: 'rdf'
      })
      const draftKey = createConceptsResponseCacheKey({
        version: 'draft',
        path: '/concepts',
        endpointPath: '/concepts',
        pageNum: 1,
        pageSize: 2000,
        format: 'rdf'
      })

      expect(publishedKey).not.toEqual(draftKey)
      expect(publishedKey).toContain(`${CACHE_KEY_PREFIX}:published`)
      expect(draftKey).toContain(`${CACHE_KEY_PREFIX}:draft`)
    })
  })

  describe('when reading from redis cache', () => {
    test('returns null when redis is not available', async () => {
      const result = await getCachedConceptsResponse('key')
      expect(result).toBeNull()
    })

    test('returns parsed response on redis hit', async () => {
      getRedisClient.mockResolvedValue({
        get: vi.fn().mockResolvedValue('{"statusCode":200}')
      })

      const result = await getCachedConceptsResponse('key')

      expect(result).toEqual({ statusCode: 200 })
    })

    test('returns null when redis cache key is missing', async () => {
      getRedisClient.mockResolvedValue({
        get: vi.fn().mockResolvedValue(null)
      })

      const result = await getCachedConceptsResponse('key')

      expect(result).toBeNull()
    })

    test('returns null on invalid cached JSON', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      getRedisClient.mockResolvedValue({
        get: vi.fn().mockResolvedValue('{invalid json')
      })

      const result = await getCachedConceptsResponse('key')

      expect(result).toBeNull()
    })
  })

  describe('when writing to redis cache', () => {
    test('stores serialized response', async () => {
      const set = vi.fn().mockResolvedValue('OK')
      getRedisClient.mockResolvedValue({ set })

      await setCachedConceptsResponse({
        cacheKey: 'key',
        response: { statusCode: 200 }
      })

      expect(set).toHaveBeenCalledWith('key', '{"statusCode":200}')
    })

    test('does nothing when redis is unavailable', async () => {
      getRedisClient.mockResolvedValue(null)

      await expect(setCachedConceptsResponse({
        cacheKey: 'key',
        response: { statusCode: 200 }
      })).resolves.toBeUndefined()
    })
  })

  describe('when clearing redis cache', () => {
    test('deletes keys matching concepts cache prefix', async () => {
      const del = vi.fn().mockResolvedValue(2)
      const scan = vi.fn()
        .mockResolvedValueOnce({
          cursor: '0',
          keys: [`${CACHE_KEY_PREFIX}:a`, `${CACHE_KEY_PREFIX}:b`]
        })

      getRedisClient.mockResolvedValue({
        del,
        scan
      })

      const deleted = await clearConceptsResponseCache()

      expect(deleted).toBe(2)
      expect(del).toHaveBeenCalledWith([`${CACHE_KEY_PREFIX}:a`, `${CACHE_KEY_PREFIX}:b`])
    })

    test('returns zero when redis is unavailable', async () => {
      getRedisClient.mockResolvedValue(null)

      const deleted = await clearConceptsResponseCache()

      expect(deleted).toBe(0)
    })

    test('recursively scans until cursor is complete', async () => {
      const del = vi.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
      const scan = vi.fn()
        .mockResolvedValueOnce({
          cursor: '1',
          keys: [`${CACHE_KEY_PREFIX}:a`]
        })
        .mockResolvedValueOnce({
          cursor: '0',
          keys: [`${CACHE_KEY_PREFIX}:b`]
        })

      getRedisClient.mockResolvedValue({
        del,
        scan
      })

      const deleted = await clearConceptsResponseCache()

      expect(deleted).toBe(2)
      expect(scan).toHaveBeenCalledTimes(2)
    })

    test('continues scanning when current page has no keys', async () => {
      const del = vi.fn().mockResolvedValue(1)
      const scan = vi.fn()
        .mockResolvedValueOnce({
          cursor: '1',
          keys: []
        })
        .mockResolvedValueOnce({
          cursor: '0',
          keys: [`${CACHE_KEY_PREFIX}:z`]
        })

      getRedisClient.mockResolvedValue({
        del,
        scan
      })

      const deleted = await clearConceptsResponseCache()

      expect(deleted).toBe(1)
      expect(scan).toHaveBeenCalledTimes(2)
    })

    test('stops when redis scan returns numeric zero cursor', async () => {
      const del = vi.fn().mockResolvedValue(1)
      const scan = vi.fn().mockResolvedValue({
        cursor: 0,
        keys: [`${CACHE_KEY_PREFIX}:n`]
      })

      getRedisClient.mockResolvedValue({
        del,
        scan
      })

      const deleted = await clearConceptsResponseCache()

      expect(deleted).toBe(1)
      expect(scan).toHaveBeenCalledTimes(1)
    })

    test('stops when redis scan returns a repeated cursor to prevent scan loop', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const del = vi.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
      const scan = vi.fn()
        .mockResolvedValueOnce({
          cursor: '1',
          keys: [`${CACHE_KEY_PREFIX}:a`]
        })
        .mockResolvedValueOnce({
          cursor: '1',
          keys: [`${CACHE_KEY_PREFIX}:b`]
        })

      getRedisClient.mockResolvedValue({
        del,
        scan
      })

      const deleted = await clearConceptsResponseCache()

      expect(deleted).toBe(2)
      expect(scan).toHaveBeenCalledTimes(2)
      expect(console.warn).toHaveBeenCalledWith(
        '[cache-prime] clear-scan detected repeated cursor=1; stopping to prevent scan loop'
      )
    })
  })
})
