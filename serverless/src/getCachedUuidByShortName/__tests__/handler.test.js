import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCachedUuidByShortName } from '@/getCachedUuidByShortName/handler'
import { createUuidResponseCacheKeyByShortName } from '@/shared/redisCacheKeys'
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
  createUuidResponseCacheKeyByShortName: vi.fn((p) => `mock-key:${p.shortName}`)
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

describe('getCachedUuidByShortName', () => {
  test('should return 400 if shortName is not provided', async () => {
    const event = { pathParameters: {} }
    const result = await getCachedUuidByShortName(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('shortName is required')
  })

  test('should return 400 if pathParameters is null', async () => {
    const event = { pathParameters: null }
    const result = await getCachedUuidByShortName(event)

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('shortName is required')
  })

  test('should return the cached response if a UUID is found', async () => {
    const shortName = 'TERRA'
    const mockResponse = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: 'mock-uuid-123' })
    }
    getCachedJsonResponse.mockResolvedValue(mockResponse)

    const event = { pathParameters: { shortName } }
    const result = await getCachedUuidByShortName(event)

    expect(createUuidResponseCacheKeyByShortName).toHaveBeenCalledWith({ shortName })
    expect(getCachedJsonResponse).toHaveBeenCalledWith({
      cacheKey: 'mock-key:TERRA',
      entityLabel: 'UUID by shortName'
    })

    expect(result).toEqual(mockResponse)
  })

  test('should return 404 if the UUID is not found in the cache', async () => {
    const shortName = 'AQUA'
    getCachedJsonResponse.mockResolvedValue(null)

    const event = { pathParameters: { shortName } }
    const result = await getCachedUuidByShortName(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).error).toBe('UUID not found for the given shortName')
  })

  test('should return 500 if an error occurs during cache retrieval', async () => {
    const shortName = 'ERROR'
    const error = new Error('Redis connection failed')
    getCachedJsonResponse.mockRejectedValue(error)

    const event = { pathParameters: { shortName } }
    const result = await getCachedUuidByShortName(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toBe(error.toString())
  })
})
