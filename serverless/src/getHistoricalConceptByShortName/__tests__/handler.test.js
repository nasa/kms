import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getHistoricalConceptByShortName } from '@/getHistoricalConceptByShortName/handler'
import { createConceptResponseCacheKeyByShortName } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

// Mock shared modules
let mockSchemes = ['platforms', 'instruments']
const mockConfig = {
  defaultResponseHeaders: { 'Access-Control-Allow-Origin': '*' },
  get schemesForHistoricalConceptByShortName() {
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
  createConceptResponseCacheKeyByShortName: vi.fn(
    ({ shortName, scheme }) => `kms:${scheme}:historical_concept:short_name:${shortName}`
  )
}))

vi.mock('@/shared/constants/shortNameForHistoricalConceptSchemes', () => ({
  DEFAULT_HISTORICAL_CONCEPT_SHORT_NAME_SCHEMES: ['default-short-name-scheme']
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

describe('getHistoricalConceptByShortName', () => {
  afterEach(() => {
    // Reset mock schemes after each test
    mockSchemes = ['platforms', 'instruments']
  })

  test('should use the default list from constants if the config list is empty', async () => {
    mockSchemes = [] // Simulate an empty config from Bamboo

    const event = {
      pathParameters: { shortName: 'any' },
      queryStringParameters: { scheme: 'default-short-name-scheme' } // This is in the mocked default list
    }

    const result = await getHistoricalConceptByShortName(event)
    // We expect it NOT to return a 400 error, which means it passed the scheme check
    expect(result.statusCode).not.toBe(400)
  })

  test('should return 400 if shortName is not provided', async () => {
    const event = {
      pathParameters: {},
      queryStringParameters: { scheme: 'platforms' }
    }
    const result = await getHistoricalConceptByShortName(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('shortName is required')
  })

  test('should pass if the scheme is supported, ignoring case', async () => {
    const event = {
      pathParameters: { shortName: 'any' },
      queryStringParameters: { scheme: 'Platforms' } // Mixed case
    }
    const result = await getHistoricalConceptByShortName(event)
    // Should not fail with a 400 for scheme validation
    expect(result.statusCode).not.toBe(400)
  })

  test('should pass if the scheme is DataFormat, ignoring case', async () => {
    mockSchemes = ['DataFormat']
    const event = {
      pathParameters: { shortName: 'any' },
      queryStringParameters: { scheme: 'DataFormat' } // Exact case from default list
    }
    const result = await getHistoricalConceptByShortName(event)
    // Should not fail with a 400 for scheme validation
    expect(result.statusCode).not.toBe(400)
  })

  test('should return 400 if the scheme is not supported for caching by shortName', async () => {
    const event = {
      pathParameters: { shortName: 'any' },
      queryStringParameters: { scheme: 'invalid-scheme' }
    }
    const result = await getHistoricalConceptByShortName(event)

    expect(result.statusCode).toBe(400)
    const expectedError = `Caching by shortName is not supported for the '${'invalid-scheme'}' scheme`
    expect(JSON.parse(result.body).error).toBe(expectedError)
  })

  test('should return 400 if scheme is not provided', async () => {
    const event = {
      pathParameters: { shortName: 'any' },
      queryStringParameters: {}
    }
    const result = await getHistoricalConceptByShortName(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('scheme is required')
  })

  test('should return 400 if pathParameters is null', async () => {
    const event = {
      pathParameters: null,
      queryStringParameters: { scheme: 'platforms' }
    }
    const result = await getHistoricalConceptByShortName(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('shortName is required')
  })

  test('should return the cached response if a UUID is found', async () => {
    const shortName = 'TERRA'
    const scheme = 'platforms'
    const mockResponse = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: 'mock-uuid-123' })
    }
    getCachedJsonResponse.mockResolvedValue(mockResponse)

    const event = {
      pathParameters: { shortName },
      queryStringParameters: { scheme }
    }
    const result = await getHistoricalConceptByShortName(event)

    expect(createConceptResponseCacheKeyByShortName).toHaveBeenCalledWith({
      shortName: shortName.toLowerCase(),
      scheme
    })

    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'kms:platforms:historical_concept:short_name:terra',
      entityLabel: 'Historical Concept by shortName'
    })

    expect(result).toEqual(mockResponse)
  })

  test('should return 404 if the UUID is not found in the cache', async () => {
    const shortName = 'AQUA'
    const scheme = 'platforms'
    getCachedJsonResponse.mockResolvedValue(null)

    const event = {
      pathParameters: { shortName },
      queryStringParameters: { scheme }
    }
    const result = await getHistoricalConceptByShortName(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).error).toBe('Cached Concept not found for the given shortName')
  })

  test('should return 500 if an error occurs during cache retrieval', async () => {
    const shortName = 'ERROR'
    const scheme = 'platforms'
    const error = new Error('Redis connection failed')
    getCachedJsonResponse.mockRejectedValue(error)

    const event = {
      pathParameters: { shortName },
      queryStringParameters: { scheme }
    }
    const result = await getHistoricalConceptByShortName(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toBe(error.toString())
  })

  test('should handle URL-encoded shortName correctly', async () => {
    const shortName = 'A%2FB-C' // 'A/B-C'
    const scheme = 'platforms'
    getCachedJsonResponse.mockResolvedValue(null) // It doesn't need to find it for this test

    const event = {
      pathParameters: { shortName },
      queryStringParameters: { scheme }
    }
    await getHistoricalConceptByShortName(event)

    // Verify it was decoded and lowercased before creating the cache key
    expect(createConceptResponseCacheKeyByShortName).toHaveBeenCalledWith({
      shortName: 'a/b-c',
      scheme
    })
  })
})
