import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getHistoricalConceptByFullPath } from '@/getHistoricalConceptByFullPath/handler'
import { createConceptResponseCacheKeyByFullPath } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

// Mock shared modules
const mockConfig = {
  defaultResponseHeaders: { 'Access-Control-Allow-Origin': '*' }
}

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => mockConfig)
}))

vi.mock('@/shared/redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn()
}))

vi.mock('@/shared/redisCacheKeys', () => ({
  createConceptResponseCacheKeyByFullPath: vi.fn(
    ({ fullPath, scheme }) => `kms:${scheme}:historical_concept:full_path:${fullPath}`
  )
}))

vi.mock('@/shared/constants/fullPathForHistoricalConceptSchemes', () => ({
  HISTORICAL_CONCEPT_FULL_PATH_SCHEMES: ['sciencekeywords', 'locations']
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

describe('getHistoricalConceptByFullPath', () => {
  test('should return 400 if fullPath is not provided', async () => {
    const event = {
      pathParameters: {},
      queryStringParameters: { scheme: 'sciencekeywords' }
    }
    const result = await getHistoricalConceptByFullPath(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('fullPath is required')
  })

  test('should pass if the scheme is supported, ignoring case', async () => {
    getCachedJsonResponse.mockResolvedValue(null)

    const event = {
      pathParameters: { fullPath: 'any' },
      queryStringParameters: { scheme: 'ScienceKeywords' } // Mixed case
    }
    const result = await getHistoricalConceptByFullPath(event)

    // Should return 404 (not found) rather than 400 (unsupported scheme)
    expect(result.statusCode).toBe(404)
  })

  test('should return 400 if the scheme is not supported for caching by fullPath', async () => {
    const event = {
      pathParameters: { fullPath: 'any' },
      queryStringParameters: { scheme: 'invalid-scheme' }
    }
    const result = await getHistoricalConceptByFullPath(event)

    expect(result.statusCode).toBe(400)
    const expectedError = `Caching by fullPath is not supported for the '${'invalid-scheme'}' scheme`
    expect(JSON.parse(result.body).error).toBe(expectedError)
  })

  test('should return 400 if scheme is not provided', async () => {
    const event = {
      pathParameters: { fullPath: 'some-path' },
      queryStringParameters: {}
    }
    const result = await getHistoricalConceptByFullPath(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('scheme is required')
  })

  test('should return 400 if pathParameters is null', async () => {
    const event = {
      pathParameters: null,
      queryStringParameters: { scheme: 'sciencekeywords' }
    }
    const result = await getHistoricalConceptByFullPath(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('fullPath is required')
  })

  test('should return the cached response if a UUID is found', async () => {
    const fullPath = 'EARTH SCIENCE > OCEANS'
    const scheme = 'sciencekeywords'
    const mockResponse = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: 'mock-uuid-123' })
    }
    getCachedJsonResponse.mockResolvedValue(mockResponse)

    const event = {
      pathParameters: { fullPath },
      queryStringParameters: { scheme }
    }
    const result = await getHistoricalConceptByFullPath(event)

    expect(createConceptResponseCacheKeyByFullPath).toHaveBeenCalledWith({
      fullPath: fullPath.toLowerCase(),
      scheme
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:sciencekeywords:historical_concept:full_path:earth science > oceans',
      entityLabel: 'Historical Concept by fullPath',
      bypassCache: false
    })

    expect(result).toEqual(mockResponse)
  })

  test('should pass bypassCache through to the shared cache helper when requested', async () => {
    getCachedJsonResponse.mockResolvedValue(null)

    const event = {
      pathParameters: { fullPath: 'EARTH SCIENCE > OCEANS' },
      queryStringParameters: {
        scheme: 'sciencekeywords',
        bypassCache: 'true'
      }
    }

    const result = await getHistoricalConceptByFullPath(event)

    expect(result.statusCode).toBe(404)
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:sciencekeywords:historical_concept:full_path:earth science > oceans',
      entityLabel: 'Historical Concept by fullPath',
      bypassCache: true
    })
  })

  test('should return 404 if the UUID is not found in the cache', async () => {
    const fullPath = 'EARTH SCIENCE > ATMOSPHERE'
    const scheme = 'sciencekeywords'
    getCachedJsonResponse.mockResolvedValue(null)

    const event = {
      pathParameters: { fullPath },
      queryStringParameters: { scheme }
    }
    const result = await getHistoricalConceptByFullPath(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).error).toBe('Cached Concept not found for the given fullPath')
  })

  test('should handle URL-encoded fullPath correctly', async () => {
    const fullPath = 'A%2FB%20%3E%20C' // 'A/B > C'
    const scheme = 'sciencekeywords'
    getCachedJsonResponse.mockResolvedValue(null) // It doesn't need to find it for this test

    const event = {
      pathParameters: { fullPath },
      queryStringParameters: { scheme }
    }
    await getHistoricalConceptByFullPath(event)

    // Verify it was decoded before creating the cache key
    expect(createConceptResponseCacheKeyByFullPath).toHaveBeenCalledWith({
      fullPath: 'a/b > c',
      scheme
    })
  })

  test('should return 500 if an error occurs during cache retrieval', async () => {
    const fullPath = 'SOME/ERROR'
    const scheme = 'sciencekeywords'
    const error = new Error('Redis connection failed')
    getCachedJsonResponse.mockRejectedValue(error)

    const event = {
      pathParameters: { fullPath },
      queryStringParameters: { scheme }
    }

    const result = await getHistoricalConceptByFullPath(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toBe(error.toString())
  })
})
