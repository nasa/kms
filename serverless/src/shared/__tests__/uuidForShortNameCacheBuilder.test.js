import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { createUuidResponseCacheKeyByShortName } from '../redisCacheKeys'
import { setCachedJsonResponse } from '../redisCacheStore'
import { UuidForShortNameCacheBuilder } from '../uuidForShortNameCacheBuilder'

// Mock the redisCacheStore functions
vi.mock('../redisCacheStore', () => ({
  setCachedJsonResponse: vi.fn(() => Promise.resolve())
}))

vi.mock('../redisCacheKeys', () => ({
  createUuidResponseCacheKeyByShortName: vi.fn((({ shortName, scheme }) => `kms:${scheme}:uuid:short_name:${shortName}`))
}))

describe('UuidForShortNameCacheBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new UuidForShortNameCacheBuilder()
    // Clear mocks before each test
    vi.clearAllMocks()
  })

  describe('parseCsvContent', () => {
    it('should correctly parse CSV content and extract short name', () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
"Air-based Platforms","Jet","","A-10","Thunderbolt II","2b839618-639c-44d4-9ad9-9064d12b322a"
`
      const expectedMap = new Map([
        ['AC-690A', '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d'],
        ['A-10', '2b839618-639c-44d4-9ad9-9064d12b322a']
      ])

      const result = builder.parseCsvContent(csvContent)
      expect(result).toEqual(expectedMap)
    })

    it('should handle rows where short name is missing', () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
"Air-based Platforms","Jet","","A-10","Thunderbolt II","2b839618-639c-44d4-9ad9-9064d12b322a"
`
      const expectedMap = new Map([
        ['A-10', '2b839618-639c-44d4-9ad9-9064d12b322a']
      ])

      const result = builder.parseCsvContent(csvContent)
      expect(result).toEqual(expectedMap)
    })
  })

  describe('processToCache', () => {
    it('should process CSV content and cache the results using short name', async () => {
      const csvContent = `"Instrument_Keywords_v1.0.0"
"Category","Class","Subclass","Short_Name","Long_Name","UUID"
"Air-based Platforms","Propeller","","AC-690A","Aerocommander aircraft","6fa682b9-c6b5-46ca-971f-b7ecd4bf304d"
`
      await builder.processToCache(csvContent, { scheme: 'platforms' })

      expect(setCachedJsonResponse).toHaveBeenCalledTimes(1)

      const shortName = 'AC-690A'
      const uuid = '6fa682b9-c6b5-46ca-971f-b7ecd4bf304d'
      const cacheKey = createUuidResponseCacheKeyByShortName({
        shortName,
        scheme: 'platforms'
      })
      const expectedResponse = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uuid })
      }

      expect(setCachedJsonResponse).toHaveBeenCalledWith({
        cacheKey,
        response: expectedResponse
      })
    })
  })
})
