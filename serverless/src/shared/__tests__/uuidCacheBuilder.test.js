import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { createUuidResponseCacheKeyByFullPath } from '../redisCacheKeys'
import { setCachedJsonResponse } from '../redisCacheStore'
import { UuidCacheBuilder } from '../uuidCacheBuilder'

// Mock the redisCacheStore functions
vi.mock('../redisCacheStore', () => ({
  setCachedJsonResponse: vi.fn(() => Promise.resolve())
}))

vi.mock('../redisCacheKeys', () => ({
  createUuidResponseCacheKeyByFullPath: vi.fn((({ fullPath }) => `kms:uuid:${fullPath}`))
}))

describe('UuidCacheBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new UuidCacheBuilder()
    // Clear mocks before each test
    vi.clearAllMocks()
  })

  describe('parseCsvContent', () => {
    it('should correctly parse CSV content', () => {
      const csvContent = '"Keyword Version: 23.4","Revision: 2026-03-17T17:34:00.294Z"\n"Category","Topic","Term","Variable_Level_1","UUID"\n"EARTH SCIENCE","OCEANS","AQUATIC SCIENCES","FISHERIES","fa57b0a0-9723-4195-bdd1-4f26aefa0e07"'
      const expectedMap = new Map([
        ['EARTH SCIENCE > OCEANS > AQUATIC SCIENCES > FISHERIES', 'fa57b0a0-9723-4195-bdd1-4f26aefa0e07']
      ])
      const result = builder.parseCsvContent(csvContent)
      expect(result).toEqual(expectedMap)
    })

    it('should handle rows with varying numbers of columns', () => {
      const csvContent = '"Keyword Version: 23.4","Revision: 2026-03-17T17:34:00.294Z"\n"Category","Topic","Term","UUID"\n"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","a73f94f7-fa3c-4a2c-871e-7927e0b2a7c4"\n"EARTH SCIENCE","BIOSPHERE","","9f4f9641-8692-411a-8c34-315cf118c7c3"'
      const expectedMap = new Map([
        ['EARTH SCIENCE > ATMOSPHERE > AEROSOLS', 'a73f94f7-fa3c-4a2c-871e-7927e0b2a7c4'],
        ['EARTH SCIENCE > BIOSPHERE', '9f4f9641-8692-411a-8c34-315cf118c7c3']
      ])
      const result = builder.parseCsvContent(csvContent)
      expect(result).toEqual(expectedMap)
    })
  })

  describe('processToCache', () => {
    it('should process CSV content and cache the results', async () => {
      const csvContent = `"Keyword Version: 23.4","Revision: 2026-03-17T17:34:00.294Z","Timestamp: 2026-03-17 17:35:41"
"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"
"EARTH SCIENCE","OCEANS","AQUATIC SCIENCES","FISHERIES","","","","fa57b0a0-9723-4195-bdd1-4f26aefa0e07"
"EARTH SCIENCE","OCEANS","BATHYMETRY/SEAFLOOR TOPOGRAPHY","BATHYMETRY","COASTAL BATHYMETRY","","","d80c015f-a383-4883-8309-6aab1c39f5b6"
`

      await builder.processToCache(csvContent)

      expect(setCachedJsonResponse).toHaveBeenCalled()

      // Verify one of the calls
      const fullPath = 'EARTH SCIENCE > OCEANS > AQUATIC SCIENCES > FISHERIES'
      const uuid = 'fa57b0a0-9723-4195-bdd1-4f26aefa0e07'
      const cacheKey = createUuidResponseCacheKeyByFullPath({ fullPath })
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
