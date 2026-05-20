import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { ConceptForFullPathCacheBuilder } from '../conceptForFullPathCacheBuilder'
import { logger } from '../logger'
import { createConceptResponseCacheKeyByFullPath } from '../redisCacheKeys'

const mockMSet = vi.fn(() => Promise.resolve())

const mockRedisClient = {
  mSet: mockMSet
}

// Mock the redisCacheStore functions
vi.mock('../redisCacheStore', () => ({
  getRedisClient: vi.fn(() => Promise.resolve(mockRedisClient))
}))

vi.mock('../redisCacheKeys', () => ({
  createConceptResponseCacheKeyByFullPath: vi.fn((({ fullPath, scheme }) => `kms:${scheme}:historical_concept:full_path:${fullPath}`))
}))

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

describe('ConceptForFullPathCacheBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new ConceptForFullPathCacheBuilder()
    // Clear mocks before each test
    vi.clearAllMocks()
    mockMSet.mockClear()
    mockMSet.mockResolvedValue(undefined)
  })

  describe('parseCsvContent', () => {
    test('should correctly parse CSV content', () => {
      const csvContent = '"Keyword Version: 23.4","Revision: 2026-03-17T17:34:00.294Z"\n"Category","Topic","Term","Variable_Level_1","UUID"\n"EARTH SCIENCE","OCEANS","AQUATIC SCIENCES","FISHERIES","fa57b0a0-9723-4195-bdd1-4f26aefa0e07"'
      const expectedMap = new Map([
        ['EARTH SCIENCE > OCEANS > AQUATIC SCIENCES > FISHERIES', 'fa57b0a0-9723-4195-bdd1-4f26aefa0e07']
      ])
      const result = builder.parseCsvContent(csvContent)
      expect(result).toEqual(expectedMap)
    })

    test('should handle rows with varying numbers of columns', () => {
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
    test('should process CSV content and cache the results using Redis mSet', async () => {
      const csvContent = `"Keyword Version: 23.4","Revision: 2026-03-17T17:34:00.294Z","Timestamp: 2026-03-17 17:35:41"
"Category","Topic","Term","Variable_Level_1","Variable_Level_2","Variable_Level_3","Detailed_Variable","UUID"
"EARTH SCIENCE","OCEANS","AQUATIC SCIENCES","FISHERIES","","","","fa57b0a0-9723-4195-bdd1-4f26aefa0e07"
"EARTH SCIENCE","OCEANS","BATHYMETRY/SEAFLOOR TOPOGRAPHY","BATHYMETRY","COASTAL BATHYMETRY","","","d80c015f-a383-4883-8309-6aab1c39f5b6"
`

      await builder.processToCache(csvContent, { scheme: 'sciencekeywords' })

      expect(mockMSet).toHaveBeenCalled()

      // Verify the mSet call contains the expected key-value pairs
      const calls = mockMSet.mock.calls[0][0]
      expect(calls.length).toBe(4) // 2 entries * 2 (key + value)

      // Verify one of the entries
      const fullPath = 'EARTH SCIENCE > OCEANS > AQUATIC SCIENCES > FISHERIES'
      const uuid = 'fa57b0a0-9723-4195-bdd1-4f26aefa0e07'
      const cacheKey = createConceptResponseCacheKeyByFullPath({
        fullPath: fullPath.toLowerCase(),
        scheme: 'sciencekeywords'
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

      const keyIndex = calls.indexOf(cacheKey)
      expect(keyIndex).toBeGreaterThanOrEqual(0)
      expect(calls[keyIndex + 1]).toBe(JSON.stringify(expectedResponse))
    })

    test('should throw error when mSet fails', async () => {
      const csvContent = `"Keyword Version: 23.4"
        "Category","UUID"
        "EARTH SCIENCE","a73f94f7-fa3c-4a2c-871e-7927e0b2a7c4"`
      const mockError = new Error('mSet failed')
      mockMSet.mockRejectedValueOnce(mockError)

      await expect(
        builder.processToCache(csvContent, { scheme: 'sciencekeywords' })
      ).rejects.toThrow('Failed to cache 1/1 entries for scheme=sciencekeywords')

      expect(logger.error).toHaveBeenCalled()
    })
  })
})
