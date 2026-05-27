import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { ConceptForShortNameCacheBuilder } from '../conceptForShortNameCacheBuilder'
import { logger } from '../logger'
import { createConceptResponseCacheKeyByShortName } from '../redisCacheKeys'

const mockMSet = vi.fn(() => Promise.resolve())

const mockRedisClient = {
  mSet: mockMSet
}

// Mock the dependencies
vi.mock('../redisCacheStore', () => ({
  getRedisClient: vi.fn(() => Promise.resolve(mockRedisClient))
}))

vi.mock('../redisCacheKeys', () => ({
  createConceptResponseCacheKeyByShortName: vi.fn((({ shortName, scheme }) => `kms:${scheme}:historical_concept:short_name:${shortName}`))
}))

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

describe('when using ConceptForShortNameCacheBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new ConceptForShortNameCacheBuilder()
    // Clear mocks before each test
    vi.clearAllMocks()
    mockMSet.mockClear()
    mockMSet.mockResolvedValue(undefined)
  })

  describe('when parsing CSV content', () => {
    test('should correctly parse CSV content for instruments', () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
"Air-based Platforms","Jet","","A-10","Thunderbolt II","2b839618-639c-44d4-9ad9-9064d12b322a"
`
      const expectedMap = new Map([
        ['AC-690A', {
          uuid: '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d',
          fullPath: 'Air-based Platforms > Propeller >  > AC-690A',
          longName: 'Aerocommander aircraft'
        }],
        ['A-10', {
          uuid: '2b839618-639c-44d4-9ad9-9064d12b322a',
          fullPath: 'Air-based Platforms > Jet >  > A-10',
          longName: 'Thunderbolt II'
        }]
      ])

      const result = builder.parseCsvContent(csvContent, { scheme: 'instruments' })
      expect(result).toEqual(expectedMap)
    })

    test('should correctly parse CSV content for providers', () => {
      const csvContent = `"Keyword Version: 1.0.0"
"Bucket_Level0","Bucket_Level1","Bucket_Level2","Bucket_Level3","Short_Name","Long_Name","Data_Center_URL","UUID"
"ACADEMIC","","","","ANU/ICAM","Integrated Catchment Assessment and Management Centre, Australian National University","http://icam.anu.edu.au/","268174c2-14f0-4bfc-9fe7-4ef148a26345"
`
      const expectedMap = new Map([
        ['ANU/ICAM', {
          uuid: '268174c2-14f0-4bfc-9fe7-4ef148a26345',
          fullPath: 'ACADEMIC >  >  >  > ANU/ICAM',
          longName: 'Integrated Catchment Assessment and Management Centre, Australian National University'
        }]
      ])

      const result = builder.parseCsvContent(csvContent, { scheme: 'providers' })
      expect(result).toEqual(expectedMap)
    })

    test('should handle rows where short name is missing', () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
"Air-based Platforms","Jet","","A-10","Thunderbolt II","2b839618-639c-44d4-9ad9-9064d12b322a"
`
      const expectedMap = new Map([
        ['A-10', {
          uuid: '2b839618-639c-44d4-9ad9-9064d12b322a',
          fullPath: 'Air-based Platforms > Jet >  > A-10',
          longName: 'Thunderbolt II'
        }]
      ])

      const result = builder.parseCsvContent(csvContent, { scheme: 'instruments' })
      expect(result).toEqual(expectedMap)
    })
  })

  describe('when processing short names to cache', () => {
    test('should process instrument CSV and cache the results using Redis mSet', async () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
`
      await builder.processToCache(csvContent, { scheme: 'instruments' })

      expect(mockMSet).toHaveBeenCalled()

      // Verify the mSet call contains the expected key-value pairs
      const calls = mockMSet.mock.calls[0][0]
      expect(calls.length).toBe(2) // 1 entry * 2 (key + value)

      const shortName = 'AC-690A'
      const uuid = '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d'
      const fullPath = 'Air-based Platforms > Propeller >  > AC-690A'
      const longName = 'Aerocommander aircraft'
      const cacheKey = createConceptResponseCacheKeyByShortName({
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
          fullPath,
          longName
        })
      }

      expect(calls[0]).toBe(cacheKey)
      expect(calls[1]).toBe(JSON.stringify(expectedResponse))
    })

    test('should process provider CSV and cache the results using Redis mSet', async () => {
      const csvContent = `"Keyword Version: 1.0.0"
"Bucket_Level0","Bucket_Level1","Bucket_Level2","Bucket_Level3","Short_Name","Long_Name","Data_Center_URL","UUID"
"ACADEMIC","","","","ANU/ICAM","Integrated Catchment Assessment and Management Centre, Australian National University","http://icam.anu.edu.au/","268174c2-14f0-4bfc-9fe7-4ef148a26345"
`
      await builder.processToCache(csvContent, { scheme: 'providers' })

      expect(mockMSet).toHaveBeenCalled()

      // Verify the mSet call contains the expected key-value pairs
      const calls = mockMSet.mock.calls[0][0]
      expect(calls.length).toBe(2) // 1 entry * 2 (key + value)

      const shortName = 'ANU/ICAM'
      const uuid = '268174c2-14f0-4bfc-9fe7-4ef148a26345'
      const fullPath = 'ACADEMIC >  >  >  > ANU/ICAM'
      const longName = 'Integrated Catchment Assessment and Management Centre, Australian National University'
      const cacheKey = createConceptResponseCacheKeyByShortName({
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
          fullPath,
          longName
        })
      }

      expect(calls[0]).toBe(cacheKey)
      expect(calls[1]).toBe(JSON.stringify(expectedResponse))
    })

    test('should omit longName from the response body when it is missing', () => {
      expect(builder.createResponseBody('AC-690A', {
        uuid: 'uuid-1',
        fullPath: 'Air-based Platforms > Jet >  > AC-690A',
        longName: ''
      })).toEqual({
        uuid: 'uuid-1',
        fullPath: 'Air-based Platforms > Jet >  > AC-690A'
      })
    })

    test('should throw error when mSet fails', async () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
        "Category","Class","Subclass","Short_Name","Long_Name","UUID"
        "Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"`
      const mockError = new Error('mSet failed')
      mockMSet.mockRejectedValueOnce(mockError)

      await expect(
        builder.processToCache(csvContent, { scheme: 'instruments' })
      ).rejects.toThrow('Failed to cache 1/1 entries for scheme=instruments')

      expect(logger.error).toHaveBeenCalled()
    })
  })
})
