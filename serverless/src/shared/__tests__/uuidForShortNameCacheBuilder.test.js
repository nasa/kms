import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { logger } from '../logger'
import { createUuidResponseCacheKeyByShortName } from '../redisCacheKeys'
import { setCachedJsonResponse } from '../redisCacheStore'
import { UuidForShortNameCacheBuilder } from '../uuidForShortNameCacheBuilder'

// Mock the dependencies
vi.mock('../redisCacheStore', () => ({
  setCachedJsonResponse: vi.fn(() => Promise.resolve())
}))

vi.mock('../redisCacheKeys', () => ({
  createUuidResponseCacheKeyByShortName: vi.fn((({ shortName, scheme }) => `kms:${scheme}:uuid:short_name:${shortName}`))
}))

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

describe('UuidForShortNameCacheBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new UuidForShortNameCacheBuilder()
    // Clear mocks before each test
    vi.clearAllMocks()
  })

  describe('parseCsvContent', () => {
    it('should correctly parse CSV content for instruments', () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
"Air-based Platforms","Jet","","A-10","Thunderbolt II","2b839618-639c-44d4-9ad9-9064d12b322a"
`
      const expectedMap = new Map([
        ['AC-690A', {
          uuid: '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d',
          fullPath: 'Air-based Platforms > Propeller > AC-690A'
        }],
        ['A-10', {
          uuid: '2b839618-639c-44d4-9ad9-9064d12b322a',
          fullPath: 'Air-based Platforms > Jet > A-10'
        }]
      ])

      const result = builder.parseCsvContent(csvContent, { scheme: 'instruments' })
      expect(result).toEqual(expectedMap)
    })

    it('should correctly parse CSV content for providers', () => {
      const csvContent = `"Providers_v1.0.0"
"ACADEMIC","","","","ANU/ICAM","Integrated Catchment Assessment and Management Centre, Australian National University","http://icam.anu.edu.au/","268174c2-14f0-4bfc-9fe7-4ef148a26345"
`
      const expectedMap = new Map([
        ['ANU/ICAM', {
          uuid: '268174c2-14f0-4bfc-9fe7-4ef148a26345',
          fullPath: 'ACADEMIC > ANU/ICAM'
        }]
      ])

      const result = builder.parseCsvContent(csvContent, { scheme: 'providers' })
      expect(result).toEqual(expectedMap)
    })

    it('should handle rows where short name is missing', () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
"Air-based Platforms","Jet","","A-10","Thunderbolt II","2b839618-639c-44d4-9ad9-9064d12b322a"
`
      const expectedMap = new Map([
        ['A-10', {
          uuid: '2b839618-639c-44d4-9ad9-9064d12b322a',
          fullPath: 'Air-based Platforms > Jet > A-10'
        }]
      ])

      const result = builder.parseCsvContent(csvContent, { scheme: 'instruments' })
      expect(result).toEqual(expectedMap)
    })
  })

  describe('processToCache', () => {
    it('should process instrument CSV and cache the results', async () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
`
      await builder.processToCache(csvContent, { scheme: 'instruments' })

      expect(setCachedJsonResponse).toHaveBeenCalledTimes(1)

      const shortName = 'AC-690A'
      const uuid = '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d'
      const fullPath = 'Air-based Platforms > Propeller > AC-690A'
      const cacheKey = createUuidResponseCacheKeyByShortName({
        shortName: shortName.toLowerCase(),
        scheme: 'instruments'
      })
      const expectedResponse = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid,
          fullPath
        })
      }

      expect(setCachedJsonResponse).toHaveBeenCalledWith({
        cacheKey,
        response: expectedResponse
      })
    })

    it('should process provider CSV and cache the results', async () => {
      const csvContent = `"Providers_v1.0.0"
"ACADEMIC","","","","ANU/ICAM","Integrated Catchment Assessment and Management Centre, Australian National University","http://icam.anu.edu.au/","268174c2-14f0-4bfc-9fe7-4ef148a26345"
`
      await builder.processToCache(csvContent, { scheme: 'providers' })

      expect(setCachedJsonResponse).toHaveBeenCalledTimes(1)

      const shortName = 'ANU/ICAM'
      const uuid = '268174c2-14f0-4bfc-9fe7-4ef148a26345'
      const fullPath = 'ACADEMIC > ANU/ICAM'
      const cacheKey = createUuidResponseCacheKeyByShortName({
        shortName: shortName.toLowerCase(),
        scheme: 'providers'
      })
      const expectedResponse = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid,
          fullPath
        })
      }

      expect(setCachedJsonResponse).toHaveBeenCalledWith({
        cacheKey,
        response: expectedResponse
      })
    })

    it('should log an error if caching fails', async () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"`
      const mockError = new Error('Cache write failed')
      vi.mocked(setCachedJsonResponse).mockRejectedValueOnce(mockError)

      await builder.processToCache(csvContent, { scheme: 'instruments' })

      expect(logger.error).toHaveBeenCalledWith('Error setting cache for AC-690A: Cache write failed')
    })
  })
})
