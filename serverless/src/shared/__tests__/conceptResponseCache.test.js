import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  clearConceptResponseCache,
  CONCEPT_CACHE_KEY_PREFIX,
  createConceptResponseCacheKey,
  getCachedConceptResponse,
  setCachedConceptResponse
} from '@/shared/conceptResponseCache'
import { getRedisClient } from '@/shared/getRedisClient'
import { logger } from '@/shared/logger'

vi.mock('@/shared/getRedisClient')

describe('when handling concept response cache', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getRedisClient.mockResolvedValue(null)
  })

  test('creates stable key with version, path, format, and full path', () => {
    const key = createConceptResponseCacheKey({
      version: 'published',
      path: '/concept/full_path/{fullPath+}',
      endpointPath: '/concept/full_path/Platforms%7CEarth%20Observation',
      format: 'RDF',
      conceptId: '123',
      shortName: 'SHORT NAME',
      altLabel: 'ALT LABEL',
      fullPath: 'Platforms|Earth Observation',
      scheme: 'platforms'
    })

    expect(key).toContain(`${CONCEPT_CACHE_KEY_PREFIX}:published`)
    expect(key).toContain('/concept/full_path/{fullpath+}')
    expect(key).toContain(':rdf:')
    expect(key).toContain(':123:')
    expect(key).toContain(encodeURIComponent('SHORT NAME'))
    expect(key).toContain(encodeURIComponent('ALT LABEL'))
    expect(key).toContain(encodeURIComponent('Platforms|Earth Observation'))
    expect(key).toContain(encodeURIComponent('platforms'))
  })

  test('uses default normalization when optional key fields are missing', () => {
    const key = createConceptResponseCacheKey({})

    expect(key).toBe(`${CONCEPT_CACHE_KEY_PREFIX}:published:::rdf:::::`)
  })

  test('reads and parses cached response', async () => {
    getRedisClient.mockResolvedValue({
      get: vi.fn().mockResolvedValue('{"statusCode":200}')
    })

    const cached = await getCachedConceptResponse('cache-key')
    expect(cached).toEqual({ statusCode: 200 })
  })

  test('returns null when redis client is unavailable during cache read', async () => {
    getRedisClient.mockResolvedValue(null)

    const cached = await getCachedConceptResponse('cache-key')
    expect(cached).toBeNull()
  })

  test('returns null when redis returns empty cache payload', async () => {
    getRedisClient.mockResolvedValue({
      get: vi.fn().mockResolvedValue(null)
    })

    const cached = await getCachedConceptResponse('cache-key')
    expect(cached).toBeNull()
  })

  test('returns null when cache payload is invalid JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getRedisClient.mockResolvedValue({
      get: vi.fn().mockResolvedValue('{invalid')
    })

    const cached = await getCachedConceptResponse('cache-key')
    expect(cached).toBeNull()
  })

  test('writes serialized response to redis', async () => {
    const set = vi.fn().mockResolvedValue('OK')
    getRedisClient.mockResolvedValue({ set })

    await setCachedConceptResponse({
      cacheKey: 'cache-key',
      response: { statusCode: 200 }
    })

    expect(set).toHaveBeenCalledWith('cache-key', '{"statusCode":200}')
  })

  test('does not write when redis client is unavailable', async () => {
    getRedisClient.mockResolvedValue(null)

    await expect(setCachedConceptResponse({
      cacheKey: 'cache-key',
      response: { statusCode: 200 }
    })).resolves.toBeUndefined()
  })

  test('clears concept cache keys by prefix', async () => {
    const del = vi.fn().mockResolvedValue(2)
    const scan = vi.fn().mockResolvedValue({
      cursor: '0',
      keys: [`${CONCEPT_CACHE_KEY_PREFIX}:a`, `${CONCEPT_CACHE_KEY_PREFIX}:b`]
    })
    getRedisClient.mockResolvedValue({
      scan,
      del
    })

    const deleted = await clearConceptResponseCache()

    expect(deleted).toBe(2)
    expect(del).toHaveBeenCalledWith([`${CONCEPT_CACHE_KEY_PREFIX}:a`, `${CONCEPT_CACHE_KEY_PREFIX}:b`])
  })

  test('returns zero when clearing concept cache and redis is unavailable', async () => {
    getRedisClient.mockResolvedValue(null)

    const deleted = await clearConceptResponseCache()

    expect(deleted).toBe(0)
  })

  test('continues clearing concept cache until scan cursor reaches zero', async () => {
    const del = vi.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
    const scan = vi.fn()
      .mockResolvedValueOnce({
        cursor: '1',
        keys: [`${CONCEPT_CACHE_KEY_PREFIX}:a`]
      })
      .mockResolvedValueOnce({
        cursor: '0',
        keys: [`${CONCEPT_CACHE_KEY_PREFIX}:b`]
      })
    getRedisClient.mockResolvedValue({
      scan,
      del
    })

    const deleted = await clearConceptResponseCache()

    expect(deleted).toBe(2)
    expect(scan).toHaveBeenCalledTimes(2)
  })

  test('stops clearing concept cache when scan cursor repeats to prevent loop', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const del = vi.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
    const scan = vi.fn()
      .mockResolvedValueOnce({
        cursor: '1',
        keys: [`${CONCEPT_CACHE_KEY_PREFIX}:a`]
      })
      .mockResolvedValueOnce({
        cursor: '1',
        keys: [`${CONCEPT_CACHE_KEY_PREFIX}:b`]
      })
    getRedisClient.mockResolvedValue({
      scan,
      del
    })

    const deleted = await clearConceptResponseCache()

    expect(deleted).toBe(2)
    expect(warnSpy).toHaveBeenCalledWith(
      '[cache-prime] clear-scan detected repeated cursor=1; stopping to prevent scan loop'
    )
  })
})
