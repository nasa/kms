import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcepts } from '@/getConcepts/handler'
import { getKeywordsTree } from '@/getKeywordsTree/handler'
import {
  createConceptsCacheKeyFromEvent,
  createTreeCacheKeyFromEvent,
  primeConceptsCache
} from '@/primeConceptsCache/handler'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import {
  CONCEPT_CACHE_KEY_PREFIX,
  CONCEPTS_CACHE_KEY_PREFIX,
  CONCEPTS_CACHE_VERSION_KEY,
  TREE_CACHE_KEY_PREFIX
} from '@/shared/redisCacheKeys'
import { clearCachedByPrefix, getRedisClient } from '@/shared/redisCacheStore'

vi.mock('@/getConcepts/handler')
vi.mock('@/getKeywordsTree/handler')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/redisCacheStore')
vi.mock('@/shared/redisCacheKeys', async () => vi.importActual('@/shared/redisCacheKeys'))
vi.mock('@/shared/getVersionMetadata')

describe('when priming concepts cache', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearCachedByPrefix.mockResolvedValue(0)
    getConceptSchemeDetails.mockResolvedValue([])
    getConcepts.mockResolvedValue({ statusCode: 200 })
    getKeywordsTree.mockResolvedValue({ statusCode: 200 })
    getVersionMetadata.mockResolvedValue({
      versionName: '100.0',
      created: '2026-02-24T00:00:00Z'
    })
  })

  describe('when redis is not configured', () => {
    test('returns skip message', async () => {
      getRedisClient.mockResolvedValue(null)

      const response = await primeConceptsCache()
      const body = JSON.parse(response.body)

      expect(response.statusCode).toBe(200)
      expect(body.message).toContain('Redis not configured')
    })
  })

  describe('when building cache keys from events', () => {
    test('uses fallback defaults for sparse concepts event', () => {
      const key = createConceptsCacheKeyFromEvent({
        path: '/concepts'
      })

      expect(key).toContain(':published:')
      expect(key).toContain(':/concepts:')
      expect(key).toContain(':1:2000:rdf')
    })

    test('prefers explicit concepts event values when present', () => {
      const key = createConceptsCacheKeyFromEvent({
        resource: '/concepts/concept_scheme/{conceptScheme}',
        path: '/concepts/concept_scheme/platforms',
        pathParameters: {
          conceptScheme: 'platforms',
          pattern: 'earth'
        },
        queryStringParameters: {
          version: 'draft',
          page_num: '5',
          page_size: '25',
          format: 'json'
        }
      })

      expect(key).toContain(':draft:')
      expect(key).toContain('/concepts/concept_scheme/{conceptscheme}')
      expect(key).toContain(':platforms:earth:5:25:json')
    })

    test('uses fallback defaults for sparse tree event', () => {
      const key = createTreeCacheKeyFromEvent({})

      expect(key).toContain(':published::')
    })

    test('uses explicit values for tree event when present', () => {
      const key = createTreeCacheKeyFromEvent({
        pathParameters: {
          conceptScheme: 'platforms'
        },
        queryStringParameters: {
          version: 'draft',
          filter: 'earth science'
        }
      })

      expect(key).toBe('kms:tree:draft:platforms:earth%20science')
    })
  })

  describe('when published version metadata is missing', () => {
    test('returns 404 and does not write version marker', async () => {
      const redisClient = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK')
      }
      getRedisClient.mockResolvedValue(redisClient)
      getVersionMetadata.mockResolvedValue(null)

      const response = await primeConceptsCache()
      const body = JSON.parse(response.body)

      expect(response.statusCode).toBe(404)
      expect(body.message).toContain('Published version metadata not found')
      expect(redisClient.set).not.toHaveBeenCalled()
    })
  })

  describe('when published version metadata exists', () => {
    describe('when versionMarker already matches cache', () => {
      test('returns already primed', async () => {
        const redisClient = {
          get: vi.fn().mockResolvedValue('100.0')
        }
        getRedisClient.mockResolvedValue(redisClient)

        const response = await primeConceptsCache()
        const body = JSON.parse(response.body)

        expect(response.statusCode).toBe(200)
        expect(body.message).toContain('already primed')
      })
    })

    describe('when versionMarker differs from cache', () => {
      test('logs none when no current version marker exists', async () => {
        const redisClient = {
          get: vi.fn().mockResolvedValue(null),
          set: vi.fn().mockResolvedValue('OK')
        }
        getRedisClient.mockResolvedValue(redisClient)
        getConceptSchemeDetails.mockResolvedValue([])

        const response = await primeConceptsCache()
        const body = JSON.parse(response.body)

        expect(response.statusCode).toBe(200)
        expect(body.versionMarker).toBe('100.0')
      })

      test('clears cache, primes routes, and writes version marker', async () => {
        const redisClient = {
          get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
          set: vi.fn().mockResolvedValue('OK')
        }
        getRedisClient.mockResolvedValue(redisClient)
        clearCachedByPrefix
          .mockResolvedValueOnce(12)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(3)

        getConceptSchemeDetails.mockResolvedValue([
          { notation: 'platforms' }
        ])

        const response = await primeConceptsCache()
        const body = JSON.parse(response.body)

        expect(response.statusCode).toBe(200)
        expect(body.deletedKeys).toBe(19)
        expect(body.warmed).toBeGreaterThan(0)
        expect(clearCachedByPrefix).toHaveBeenCalledTimes(3)
        expect(clearCachedByPrefix).toHaveBeenNthCalledWith(1, {
          keyPrefix: CONCEPTS_CACHE_KEY_PREFIX
        })

        expect(clearCachedByPrefix).toHaveBeenNthCalledWith(2, {
          keyPrefix: CONCEPT_CACHE_KEY_PREFIX
        })

        expect(clearCachedByPrefix).toHaveBeenNthCalledWith(3, {
          keyPrefix: TREE_CACHE_KEY_PREFIX
        })

        expect(getKeywordsTree).toHaveBeenCalledWith(
          expect.objectContaining({
            path: '/tree/concept_scheme/all'
          }),
          {}
        )

        expect(getKeywordsTree).toHaveBeenCalledWith(
          expect.objectContaining({
            path: '/tree/concept_scheme/platforms'
          }),
          {}
        )

        expect(redisClient.set).toHaveBeenCalledWith(
          CONCEPTS_CACHE_VERSION_KEY,
          '100.0'
        )
      })

      describe('when deriving pages to prime', () => {
        test('uses fallback max pages when total-pages header is missing', async () => {
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([{ notation: 'platforms' }])

          getConcepts.mockResolvedValue({
            statusCode: 200,
            headers: {}
          })

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)

          expect(response.statusCode).toBe(200)
          expect(body.maxPagesFallback).toBe(25)
          expect(getConcepts).toHaveBeenCalled()
        })

        test('uses x-total-pages lower-case header and requests additional pages', async () => {
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([{ notation: 'platforms' }])

          getConcepts
            .mockResolvedValueOnce({ statusCode: 200 })
            .mockResolvedValueOnce({
              statusCode: 200,
              headers: {
                'x-total-pages': '2'
              }
            })
            .mockResolvedValueOnce({ statusCode: 200 })
            .mockResolvedValue({
              statusCode: 200,
              headers: {
                'X-Total-Pages': '1'
              }
            })

          await primeConceptsCache()

          const page2Call = getConcepts.mock.calls.find((call) => call[0]?.queryStringParameters?.page_num === '2')
          expect(page2Call).toBeTruthy()
        })
      })

      describe('when counting failures', () => {
        test('marks failures and returns 500 for non-400 non-200 responses', async () => {
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([{ notation: 'platforms' }])

          getConcepts.mockImplementation((event) => {
            if (event?.resource === '/concepts') {
              return Promise.resolve({ statusCode: 500 })
            }

            return Promise.resolve({
              statusCode: 200,
              headers: {
                'X-Total-Pages': '1'
              }
            })
          })

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)

          expect(response.statusCode).toBe(500)
          expect(body.failed).toBeGreaterThan(0)
        })

        test('marks warm request rejection as failure', async () => {
          vi.spyOn(console, 'error').mockImplementation(() => {})
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([])
          getConcepts.mockRejectedValue(new Error('warm failed'))

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)

          expect(response.statusCode).toBe(500)
          expect(body.failed).toBeGreaterThan(0)
        })

        test('marks non-400 warm response as failure', async () => {
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([])
          getConcepts.mockResolvedValue({ statusCode: 503 })

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)

          expect(response.statusCode).toBe(500)
          expect(body.failed).toBeGreaterThan(0)
        })

        test('does not mark 400 responses as failures', async () => {
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([{ notation: 'platforms' }])

          getConcepts
            .mockResolvedValueOnce({ statusCode: 400 }) // /concepts Root Warm
            .mockResolvedValue({
              statusCode: 200,
              headers: {
                'X-Total-Pages': '1'
              }
            })

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)

          expect(response.statusCode).toBe(200)
          expect(body.failed).toBe(0)
        })

        test('does not mark 400 warm response as failure when no schemes exist', async () => {
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([])

          getConcepts.mockResolvedValue({ statusCode: 400 })

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)

          expect(response.statusCode).toBe(200)
          expect(body.failed).toBe(0)
        })

        test('counts rejected scheme prime execution as failure', async () => {
          vi.spyOn(console, 'error').mockImplementation(() => {})
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue([{ notation: 'platforms' }])

          getConcepts.mockImplementation((event) => {
            if (event?.resource === '/concepts') {
              return Promise.resolve({ statusCode: 200 })
            }

            if (event?.resource === '/concepts/concept_scheme/{conceptScheme}') {
              return Promise.reject(new Error('scheme failed'))
            }

            return Promise.resolve({
              statusCode: 200,
              headers: {
                'X-Total-Pages': '1'
              }
            })
          })

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)
          expect(response.statusCode).toBe(500)
          expect(body.failed).toBeGreaterThan(0)
        })
      })

      describe('when loading schemes to prime', () => {
        test('handles null concept scheme details by defaulting to empty list', async () => {
          const redisClient = {
            get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
            set: vi.fn().mockResolvedValue('OK')
          }
          getRedisClient.mockResolvedValue(redisClient)
          getConceptSchemeDetails.mockResolvedValue(null)
          getConcepts.mockResolvedValue({
            statusCode: 200,
            headers: {}
          })

          const response = await primeConceptsCache()
          const body = JSON.parse(response.body)

          expect(response.statusCode).toBe(200)
          expect(body.schemes).toBe(0)
        })
      })
    })
  })
})
