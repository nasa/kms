import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getConcepts } from '@/getConcepts/handler'
import { getKeywordsTree } from '@/getKeywordsTree/handler'
import { primeConceptsCache } from '@/primeConceptsCache/handler'
import { clearConceptResponseCache } from '@/shared/conceptResponseCache'
import { CACHE_VERSION_KEY, clearConceptsResponseCache } from '@/shared/conceptsResponseCache'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getRedisClient } from '@/shared/getRedisClient'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { clearTreeResponseCache } from '@/shared/treeResponseCache'

vi.mock('@/getConcepts/handler')
vi.mock('@/getKeywordsTree/handler')
vi.mock('@/shared/conceptResponseCache')
vi.mock('@/shared/conceptsResponseCache')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getRedisClient')
vi.mock('@/shared/treeResponseCache')
vi.mock('@/shared/getVersionMetadata')

describe('when priming concepts cache', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearConceptResponseCache.mockResolvedValue(0)
    clearConceptsResponseCache.mockResolvedValue(0)
    clearTreeResponseCache.mockResolvedValue(0)
    getConceptSchemeDetails.mockResolvedValue([])
    getConcepts.mockResolvedValue({ statusCode: 200 })
    getKeywordsTree.mockResolvedValue({ statusCode: 200 })
    getVersionMetadata.mockResolvedValue({
      versionName: '100.0',
      created: '2026-02-24T00:00:00Z'
    })
  })

  test('returns skip message when redis is not configured', async () => {
    getRedisClient.mockResolvedValue(null)

    const response = await primeConceptsCache()
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.message).toContain('Redis not configured')
  })

  test('returns already primed when marker matches', async () => {
    const redisClient = {
      get: vi.fn().mockResolvedValue('100.0')
    }
    getRedisClient.mockResolvedValue(redisClient)

    const response = await primeConceptsCache()
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.message).toContain('already primed')
  })

  test('clears cache, primes routes, and writes version marker when marker differs', async () => {
    const redisClient = {
      get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
      set: vi.fn().mockResolvedValue('OK')
    }
    getRedisClient.mockResolvedValue(redisClient)
    clearConceptsResponseCache.mockResolvedValue(12)
    clearConceptResponseCache.mockResolvedValue(4)
    clearTreeResponseCache.mockResolvedValue(3)
    getConceptSchemeDetails.mockResolvedValue([
      { notation: 'platforms' }
    ])

    const response = await primeConceptsCache()
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.deletedKeys).toBe(19)
    expect(body.warmed).toBeGreaterThan(0)
    expect(clearConceptsResponseCache).toHaveBeenCalledTimes(1)
    expect(clearConceptResponseCache).toHaveBeenCalledTimes(1)
    expect(clearTreeResponseCache).toHaveBeenCalledTimes(1)
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
      CACHE_VERSION_KEY,
      '100.0'
    )
  })

  test('returns 404 when published version metadata is missing', async () => {
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

  test('uses x-total-pages lower-case header and requests additional pages', async () => {
    const redisClient = {
      get: vi.fn().mockResolvedValue('99.0|2026-02-01T00:00:00Z'),
      set: vi.fn().mockResolvedValue('OK')
    }
    getRedisClient.mockResolvedValue(redisClient)
    getConceptSchemeDetails.mockResolvedValue([{ notation: 'platforms' }])

    getConcepts
      .mockResolvedValueOnce({ statusCode: 200 }) // /concepts Root
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {
          'x-total-pages': '2'
        }
      }) // Platforms Rdf p1
      .mockResolvedValueOnce({ statusCode: 200 }) // Platforms Rdf p2
      .mockResolvedValue({
        statusCode: 200,
        headers: {
          'X-Total-Pages': '1'
        }
      }) // Rest

    await primeConceptsCache()

    const page2Call = getConcepts.mock.calls.find((call) => call[0]?.queryStringParameters?.page_num === '2')
    expect(page2Call).toBeTruthy()
  })

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
