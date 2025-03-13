import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  createConceptToConceptSchemeShortNameMap
} from '../createConceptToConceptSchemeShortNameMap'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest module
vi.mock('../sparqlRequest')

describe('createConceptToConceptSchemeShortNameMap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('when the SPARQL request is successful', () => {
    test('should return a Map with concept UUIDs as keys and scheme short names as values', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                concept: { value: 'http://example.com/concept/123' },
                schemeShortName: { value: 'scheme1' }
              },
              {
                concept: { value: 'http://example.com/concept/456' },
                schemeShortName: { value: 'scheme2' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createConceptToConceptSchemeShortNameMap()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get('123')).toBe('scheme1')
      expect(result.get('456')).toBe('scheme2')
    })

    test('should handle concepts from the same scheme', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                concept: { value: 'http://example.com/concept/123' },
                schemeShortName: { value: 'scheme1' }
              },
              {
                concept: { value: 'http://example.com/concept/456' },
                schemeShortName: { value: 'scheme1' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createConceptToConceptSchemeShortNameMap()

      expect(result.size).toBe(2)
      expect(result.get('123')).toBe('scheme1')
      expect(result.get('456')).toBe('scheme1')
    })
  })

  describe('when the SPARQL request fails', () => {
    test('should throw an error and log it', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(createConceptToConceptSchemeShortNameMap()).rejects.toThrow('HTTP error! status: 500')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching concept scheme mappings:',
        expect.objectContaining({
          message: 'HTTP error! status: 500'
        })
      )

      consoleSpy.mockRestore()
    })
  })

  describe('when given an empty response', () => {
    test('should return an empty Map', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: []
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createConceptToConceptSchemeShortNameMap()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })
  })
})
