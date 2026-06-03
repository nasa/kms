import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getHistoricalConceptByFullPath } from '@/getHistoricalConceptByFullPath/handler'
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
    getHistoricalConceptByFullPath: vi.fn()
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

describe('getHistoricalConceptByFullPath', () => {
  test('returns 400 if fullPath is not provided', async () => {
    const result = await getHistoricalConceptByFullPath({
      pathParameters: {},
      queryStringParameters: { scheme: 'sciencekeywords' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('fullPath is required')
  })

  test('returns 404 for supported schemes when no cached concept is found', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockResolvedValue(undefined)

    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'any' },
      queryStringParameters: { scheme: 'ScienceKeywords' }
    })

    expect(result.statusCode).toBe(404)
    expect(redisPathStore.getHistoricalConceptByFullPath).toHaveBeenCalledWith({
      fullPath: 'any',
      scheme: 'sciencekeywords',
      bypassCache: false
    })
  })

  test('returns 400 if the scheme is not supported for caching by fullPath', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockRejectedValue(
      new Error('Historical fullPath lookup is not supported for scheme=invalid-scheme')
    )

    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'any' },
      queryStringParameters: { scheme: 'invalid-scheme' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error)
      .toBe("Caching by fullPath is not supported for the 'invalid-scheme' scheme")
  })

  test('returns 400 if scheme is not provided', async () => {
    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'some-path' },
      queryStringParameters: {}
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('scheme is required')
  })

  test('returns 400 if queryStringParameters is missing', async () => {
    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'some-path' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('scheme is required')
  })

  test('returns 400 if pathParameters is null', async () => {
    const result = await getHistoricalConceptByFullPath({
      pathParameters: null,
      queryStringParameters: { scheme: 'sciencekeywords' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body).error).toBe('fullPath is required')
  })

  test('returns the concept response when a historical concept is found', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockResolvedValue({
      uuid: 'mock-uuid-123',
      fullPath: 'EARTH SCIENCE > OCEANS'
    })

    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'EARTH SCIENCE > OCEANS' },
      queryStringParameters: { scheme: 'sciencekeywords' }
    })

    expect(result).toEqual({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uuid: 'mock-uuid-123',
        fullPath: 'EARTH SCIENCE > OCEANS'
      })
    })
  })

  test('passes bypassCache through to the store when requested', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockResolvedValue(undefined)

    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'EARTH SCIENCE > OCEANS' },
      queryStringParameters: {
        scheme: 'sciencekeywords',
        bypassCache: 'true'
      }
    })

    expect(result.statusCode).toBe(404)
    expect(redisPathStore.getHistoricalConceptByFullPath).toHaveBeenCalledWith({
      fullPath: 'earth science > oceans',
      scheme: 'sciencekeywords',
      bypassCache: true
    })
  })

  test('returns 404 if the concept is not found in the cache', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockResolvedValue(undefined)

    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'EARTH SCIENCE > ATMOSPHERE' },
      queryStringParameters: { scheme: 'sciencekeywords' }
    })

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).error).toBe('Cached Concept not found for the given fullPath')
  })

  test('decodes URL-encoded fullPath before calling the store', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockResolvedValue(undefined)

    await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'A%2FB%20%3E%20C' },
      queryStringParameters: { scheme: 'sciencekeywords' }
    })

    expect(redisPathStore.getHistoricalConceptByFullPath).toHaveBeenCalledWith({
      fullPath: 'a/b > c',
      scheme: 'sciencekeywords',
      bypassCache: false
    })
  })

  test('returns 500 for unexpected lookup errors', async () => {
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockRejectedValue(
      new Error('cache failure')
    )

    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'EARTH SCIENCE > ATMOSPHERE' },
      queryStringParameters: { scheme: 'sciencekeywords' }
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
    vi.mocked(redisPathStore.getHistoricalConceptByFullPath).mockRejectedValue({})

    const result = await getHistoricalConceptByFullPath({
      pathParameters: { fullPath: 'EARTH SCIENCE > ATMOSPHERE' },
      queryStringParameters: { scheme: 'sciencekeywords' }
    })

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body).error).toBe('[object Object]')
  })
})
