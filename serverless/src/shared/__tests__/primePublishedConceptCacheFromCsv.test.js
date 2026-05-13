import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '../logger'
import { primePublishedConceptCacheFromCsv } from '../primePublishedConceptCacheFromCsv'
import { clearCachedByPrefix, getRedisClient } from '../redisCacheStore'

const mockParseFullPathCsvContent = vi.fn()
const mockCreateFullPathResponseBody = vi.fn()
const mockParseShortNameCsvContent = vi.fn()
const mockCreateShortNameResponseBody = vi.fn()

vi.mock('../conceptForFullPathCacheBuilder', () => ({
  ConceptForFullPathCacheBuilder: vi.fn(() => ({
    parseCsvContent: mockParseFullPathCsvContent,
    createResponseBody: mockCreateFullPathResponseBody
  }))
}))

vi.mock('../conceptForShortNameCacheBuilder', () => ({
  ConceptForShortNameCacheBuilder: vi.fn(() => ({
    parseCsvContent: mockParseShortNameCsvContent,
    createResponseBody: mockCreateShortNameResponseBody
  }))
}))

vi.mock('../redisCacheStore', () => ({
  clearCachedByPrefix: vi.fn(),
  getRedisClient: vi.fn()
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn()
  }
}))

describe('primePublishedConceptCacheFromCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('writes full-path published concept entries for supported full-path schemes', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }

    getRedisClient.mockResolvedValue(mockRedisClient)
    mockParseFullPathCsvContent.mockReturnValue(new Map([
      ['EARTH SCIENCE > ATMOSPHERE > AEROSOLS', 'uuid-1']
    ]))

    mockCreateFullPathResponseBody.mockReturnValue({
      uuid: 'uuid-1',
      fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
    })

    const result = await primePublishedConceptCacheFromCsv({
      csvContent: 'csv-content',
      scheme: 'sciencekeywords'
    })

    expect(mockRedisClient.mSet).toHaveBeenCalledWith([
      'kms:sciencekeywords:published_concept:full_path:earth%20science%20%3E%20atmosphere%20%3E%20aerosols',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-1',
          fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        })
      }),
      'kms:sciencekeywords:published_concept:uuid:uuid-1',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-1',
          fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
        })
      })
    ])

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:sciencekeywords:published_concept'
    })

    expect(result).toEqual({
      cachedCount: 2,
      skipped: false,
      skipReason: null,
      cacheReady: true
    })
  })

  test('writes short-name published concept entries for supported short-name schemes', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }

    getRedisClient.mockResolvedValue(mockRedisClient)
    mockParseShortNameCsvContent.mockReturnValue(new Map([
      ['Aqua', {
        uuid: 'uuid-2',
        fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua',
        longName: 'Aqua satellite'
      }]
    ]))

    mockCreateShortNameResponseBody.mockReturnValue({
      uuid: 'uuid-2',
      fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua',
      longName: 'Aqua satellite'
    })

    const result = await primePublishedConceptCacheFromCsv({
      csvContent: 'csv-content',
      scheme: 'platforms'
    })

    expect(mockParseShortNameCsvContent).toHaveBeenCalledWith('csv-content', {
      scheme: 'platforms'
    })

    expect(mockRedisClient.mSet).toHaveBeenCalledWith([
      'kms:platforms:published_concept:short_name:aqua',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-2',
          fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua',
          longName: 'Aqua satellite'
        })
      }),
      'kms:platforms:published_concept:uuid:uuid-2',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: 'uuid-2',
          fullPath: 'Platforms > Space-based Platforms > Earth Observation Satellites > Aqua',
          longName: 'Aqua satellite'
        })
      })
    ])

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:platforms:published_concept'
    })

    expect(result).toEqual({
      cachedCount: 2,
      skipped: false,
      skipReason: null,
      cacheReady: true
    })
  })

  test('skips unsupported schemes', async () => {
    getRedisClient.mockResolvedValue({
      mSet: vi.fn()
    })

    const result = await primePublishedConceptCacheFromCsv({
      csvContent: 'csv-content',
      scheme: 'unknownscheme'
    })

    expect(result).toEqual({
      cachedCount: 0,
      skipped: true,
      skipReason: 'unsupported_scheme',
      cacheReady: true
    })

    expect(mockParseFullPathCsvContent).not.toHaveBeenCalled()
    expect(mockParseShortNameCsvContent).not.toHaveBeenCalled()
  })

  test('skips cache prime when redis is unavailable', async () => {
    getRedisClient.mockResolvedValue(null)

    const result = await primePublishedConceptCacheFromCsv({
      csvContent: 'csv-content',
      scheme: 'sciencekeywords'
    })

    expect(logger.warn).toHaveBeenCalledWith(
      '[publisher] Redis not configured, skipping published concept cache prime scheme=sciencekeywords'
    )

    expect(result).toEqual({
      cachedCount: 0,
      skipped: true,
      skipReason: 'redis_unavailable',
      cacheReady: false
    })
  })

  test('throws when csv content or scheme is missing', async () => {
    await expect(primePublishedConceptCacheFromCsv({
      scheme: 'sciencekeywords'
    })).rejects.toThrow('csvContent and scheme are required to prime published concept cache')

    await expect(primePublishedConceptCacheFromCsv({
      csvContent: 'csv-content'
    })).rejects.toThrow('csvContent and scheme are required to prime published concept cache')
  })

  test('normalizes granuledataformat to the dataformat cache namespace and skips uuid cache writes when the response body has no uuid', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }

    getRedisClient.mockResolvedValue(mockRedisClient)
    mockParseShortNameCsvContent.mockReturnValue(new Map([
      ['NetCDF', {
        uuid: 'uuid-3',
        fullPath: 'Data Format > NetCDF'
      }]
    ]))

    mockCreateShortNameResponseBody.mockReturnValue({
      fullPath: 'Data Format > NetCDF'
    })

    const result = await primePublishedConceptCacheFromCsv({
      csvContent: 'csv-content',
      scheme: 'granuledataformat'
    })

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:dataformat:published_concept'
    })

    expect(mockRedisClient.mSet).toHaveBeenCalledWith([
      'kms:dataformat:published_concept:short_name:netcdf',
      JSON.stringify({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullPath: 'Data Format > NetCDF'
        })
      })
    ])

    expect(result).toEqual({
      cachedCount: 1,
      skipped: false,
      skipReason: null,
      cacheReady: true
    })
  })

  test('returns a successful empty result when parsed records produce no cacheable entries', async () => {
    const mockRedisClient = {
      mSet: vi.fn().mockResolvedValue('OK')
    }

    getRedisClient.mockResolvedValue(mockRedisClient)
    mockParseFullPathCsvContent.mockReturnValue(new Map([
      ['', 'uuid-ignored']
    ]))

    const result = await primePublishedConceptCacheFromCsv({
      csvContent: 'csv-content',
      scheme: 'sciencekeywords'
    })

    expect(clearCachedByPrefix).toHaveBeenCalledWith({
      keyPrefix: 'kms:sciencekeywords:published_concept'
    })

    expect(mockRedisClient.mSet).not.toHaveBeenCalled()
    expect(result).toEqual({
      cachedCount: 0,
      skipped: false,
      skipReason: null,
      cacheReady: true
    })
  })
})
