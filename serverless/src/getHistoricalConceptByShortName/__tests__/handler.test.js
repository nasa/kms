import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getHistoricalConceptByShortName } from '@/getHistoricalConceptByShortName/handler'
import { logger } from '@/shared/logger'
import { redisPathStore } from '@/shared/redisPathStore'

const mockConfig = {
  defaultResponseHeaders: { 'Access-Control-Allow-Origin': '*' }
}

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => mockConfig)
}))

vi.mock('@/shared/redisPathStore', () => ({
  redisPathStore: {
    getHistoricalConceptByShortName: vi.fn()
  }
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

describe('getHistoricalConceptByShortName', () => {
  test('returns 400 if shortName is not provided', async () => {
    const result = await getHistoricalConceptByShortName({
      pathParameters: {},
      queryStringParameters: { scheme: 'platforms' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('shortName is required')
  })

  test('returns 404 for supported schemes when no cached concept is found', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockResolvedValue(undefined)

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'any' },
      queryStringParameters: { scheme: 'Platforms' }
    })

    expect(result.statusCode).toBe(404)
    expect(redisPathStore.getHistoricalConceptByShortName).toHaveBeenCalledWith({
      shortName: 'any',
      scheme: 'platforms',
      bypassCache: false
    })
  })

  test('accepts DataFormat regardless of case', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockResolvedValue(undefined)

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'any' },
      queryStringParameters: { scheme: 'DataFormat' }
    })

    expect(result.statusCode).toBe(404)
    expect(redisPathStore.getHistoricalConceptByShortName).toHaveBeenCalledWith({
      shortName: 'any',
      scheme: 'dataformat',
      bypassCache: false
    })
  })

  test('returns 400 if the scheme is not supported for caching by shortName', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockRejectedValue(
      new Error('Historical shortName lookup is not supported for scheme=invalid-scheme')
    )

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'any' },
      queryStringParameters: { scheme: 'invalid-scheme' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error)
      .toBe("Caching by shortName is not supported for the 'invalid-scheme' scheme")
  })

  test('returns 400 if scheme is not provided', async () => {
    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'any' },
      queryStringParameters: {}
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('scheme is required')
  })

  test('returns 400 if queryStringParameters is missing', async () => {
    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'any' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('scheme is required')
  })

  test('returns 400 if pathParameters is null', async () => {
    const result = await getHistoricalConceptByShortName({
      pathParameters: null,
      queryStringParameters: { scheme: 'platforms' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('shortName is required')
  })

  test('returns the concept response when a historical concept is found', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockResolvedValue({
      uuid: 'mock-uuid-123',
      fullPath: 'Platforms > Space-based Platforms > TERRA',
      longName: 'Terra (satellite)'
    })

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'TERRA' },
      queryStringParameters: { scheme: 'platforms' }
    })

    expect(result).toEqual({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uuid: 'mock-uuid-123',
        fullPath: 'Platforms > Space-based Platforms > TERRA',
        longName: 'Terra (satellite)'
      })
    })
  })

  test('passes bypassCache through to the store when requested', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockResolvedValue(undefined)

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'TERRA' },
      queryStringParameters: {
        scheme: 'platforms',
        bypassCache: 'true'
      }
    })

    expect(result.statusCode).toBe(404)
    expect(redisPathStore.getHistoricalConceptByShortName).toHaveBeenCalledWith({
      shortName: 'terra',
      scheme: 'platforms',
      bypassCache: true
    })
  })

  test('returns 404 if the concept is not found in the cache', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockResolvedValue(undefined)

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'AQUA' },
      queryStringParameters: { scheme: 'platforms' }
    })

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).error).toBe('Cached Concept not found for the given shortName')
  })

  test('decodes URL-encoded shortName before calling the store', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockResolvedValue(undefined)

    await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'A%2FB' },
      queryStringParameters: { scheme: 'platforms' }
    })

    expect(redisPathStore.getHistoricalConceptByShortName).toHaveBeenCalledWith({
      shortName: 'a/b',
      scheme: 'platforms',
      bypassCache: false
    })
  })

  test('returns 500 for unexpected lookup errors', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockRejectedValue(
      new Error('cache failure')
    )

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'AQUA' },
      queryStringParameters: { scheme: 'platforms' }
    })

    expect(result).toEqual({
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      statusCode: 500,
      body: JSON.stringify({
        error: 'Error: cache failure'
      })
    })

    expect(logger.error).toHaveBeenCalledWith(
      'Error retrieving historical concept, error=Error: cache failure'
    )
  })

  test('returns 500 when an unexpected lookup error has no message', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByShortName).mockRejectedValue({})

    const result = await getHistoricalConceptByShortName({
      pathParameters: { shortName: 'AQUA' },
      queryStringParameters: { scheme: 'platforms' }
    })

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toBe('[object Object]')
  })
})
