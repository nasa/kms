import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCachedUuid } from '@/getCachedUuid/handler'
import { createUuidResponseCacheKey } from '@/shared/redisCacheKeys'
import { getCachedJsonResponse } from '@/shared/redisCacheStore'

// Mock shared modules
vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: { 'Access-Control-Allow-Origin': '*' }
  }))
}))

vi.mock('@/shared/redisCacheStore', () => ({
  getCachedJsonResponse: vi.fn()
}))

vi.mock('@/shared/redisCacheKeys', () => ({
  createUuidResponseCacheKey: vi.fn((p) => `mock-key:${p.fullPath}`)
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

describe('getCachedUuid', () => {
  test('should return 400 if fullPath is not provided', async () => {
    const event = { pathParameters: {} }
    const result = await getCachedUuid(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('fullPath is required')
  })

  test('should return 400 if pathParameters is null', async () => {
    const event = { pathParameters: null }
    const result = await getCachedUuid(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('fullPath is required')
  })

  test('should return the cached response if a UUID is found', async () => {
    const fullPath = 'PLATFORMS/TERRA'
    const mockResponse = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: 'mock-uuid-123' })
    }
    getCachedJsonResponse.mockResolvedValue(mockResponse)

    const event = { pathParameters: { fullPath } }
    const result = await getCachedUuid(event)

    expect(createUuidResponseCacheKey).toHaveBeenCalledWith({ fullPath })
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'mock-key:PLATFORMS/TERRA',
      entityLabel: 'uuid by fullPath'
    })

    expect(result).toEqual(mockResponse)
  })

  test('should return 404 if the UUID is not found in the cache', async () => {
    const fullPath = 'PLATFORMS/AQUA'
    getCachedJsonResponse.mockResolvedValue(null)

    const event = { pathParameters: { fullPath } }
    const result = await getCachedUuid(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).error).toBe('UUID not found for the given fullPath')
  })

  test('should handle URL-encoded fullPath correctly', async () => {
    const fullPath = 'A%2FB%20%3E%20C' // 'A/B > C'
    getCachedJsonResponse.mockResolvedValue(null) // It doesn't need to find it for this test

    const event = { pathParameters: { fullPath } }
    await getCachedUuid(event)

    // Verify it was decoded before creating the cache key
    expect(createUuidResponseCacheKey).toHaveBeenCalledWith({ fullPath: 'A/B > C' })
  })

  test('should return 500 if an error occurs during cache retrieval', async () => {
    const fullPath = 'PLATFORMS/ERROR'
    const error = new Error('Redis connection failed')
    getCachedJsonResponse.mockRejectedValue(error)

    const event = { pathParameters: { fullPath } }
    const result = await getCachedUuid(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toBe(error.toString())
  })
})
