import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCachedUuidByFullPath } from '@/getCachedUuidByFullPath/handler'
import { createUuidResponseCacheKeyByFullPath } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

// Mock shared modules
let mockSchemes = ['sciencekeywords', 'locations']
const mockConfig = {
  defaultResponseHeaders: { 'Access-Control-Allow-Origin': '*' },
  get schemesForUuidByFullPath() {
    return mockSchemes
  }
}

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => mockConfig)
}))

vi.mock('@/shared/redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn()
}))

vi.mock('@/shared/redisCacheKeys', () => ({
  createUuidResponseCacheKeyByFullPath: vi.fn(
    ({ fullPath, scheme }) => `kms:${scheme}:uuid:full_path:${fullPath}`
  )
}))

vi.mock('@/shared/constants/fullPathForUuidSchemes', () => ({
  DEFAULT_FULL_PATH_SCHEMES: ['default-full-path-scheme']
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

describe('getCachedUuidByFullPath', () => {
  afterEach(() => {
    // Reset mock schemes after each test
    mockSchemes = ['sciencekeywords', 'locations']
  })

  test('should use the default list from constants if the config list is empty', async () => {
    mockSchemes = [] // Simulate an empty config from Bamboo

    const event = {
      pathParameters: { fullPath: 'any' },
      queryStringParameters: { scheme: 'default-full-path-scheme' } // This is in the mocked default list
    }

    const result = await getCachedUuidByFullPath(event)
    // We expect it NOT to return a 400 error, which means it passed the scheme check
    expect(result.statusCode).not.toBe(400)
  })

  test('should return 400 if fullPath is not provided', async () => {
    const event = {
      pathParameters: {},
      queryStringParameters: { scheme: 'sciencekeywords' }
    }
    const result = await getCachedUuidByFullPath(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('fullPath is required')
  })

  test('should pass if the scheme is supported, ignoring case', async () => {
    const event = {
      pathParameters: { fullPath: 'any' },
      queryStringParameters: { scheme: 'ScienceKeywords' } // Mixed case
    }
    const result = await getCachedUuidByFullPath(event)

    // Should not fail with a 400 for scheme validation
    expect(result.statusCode).not.toBe(400)
  })

  test('should return 400 if the scheme is not supported for caching by fullPath', async () => {
    const event = {
      pathParameters: { fullPath: 'any' },
      queryStringParameters: { scheme: 'invalid-scheme' }
    }
    const result = await getCachedUuidByFullPath(event)

    expect(result.statusCode).toBe(400)
    const expectedError = `Caching by fullPath is not supported for the '${'invalid-scheme'}' scheme`
    expect(JSON.parse(result.body).error).toBe(expectedError)
  })

  test('should return 400 if scheme is not provided', async () => {
    const event = {
      pathParameters: { fullPath: 'some-path' },
      queryStringParameters: {}
    }
    const result = await getCachedUuidByFullPath(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('scheme is required')
  })

  test('should return 400 if pathParameters is null', async () => {
    const event = {
      pathParameters: null,
      queryStringParameters: { scheme: 'sciencekeywords' }
    }
    const result = await getCachedUuidByFullPath(event)

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
    const result = await getCachedUuidByFullPath(event)

    expect(createUuidResponseCacheKeyByFullPath).toHaveBeenCalledWith({
      fullPath,
      scheme
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:sciencekeywords:uuid:full_path:EARTH SCIENCE > OCEANS',
      entityLabel: 'UUID by fullPath'
    })

    expect(result).toEqual(mockResponse)
  })

  test('should return 404 if the UUID is not found in the cache', async () => {
    const fullPath = 'EARTH SCIENCE > ATMOSPHERE'
    const scheme = 'sciencekeywords'
    getCachedJsonResponse.mockResolvedValue(null)

    const event = {
      pathParameters: { fullPath },
      queryStringParameters: { scheme }
    }
    const result = await getCachedUuidByFullPath(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).error).toBe('UUID not found for the given fullPath')
  })

  test('should handle URL-encoded fullPath correctly', async () => {
    const fullPath = 'A%2FB%20%3E%20C' // 'A/B > C'
    const scheme = 'sciencekeywords'
    getCachedJsonResponse.mockResolvedValue(null) // It doesn't need to find it for this test

    const event = {
      pathParameters: { fullPath },
      queryStringParameters: { scheme }
    }
    await getCachedUuidByFullPath(event)

    // Verify it was decoded before creating the cache key
    expect(createUuidResponseCacheKeyByFullPath).toHaveBeenCalledWith({
      fullPath: 'A/B > C',
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

    const result = await getCachedUuidByFullPath(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toBe(error.toString())
  })
})
