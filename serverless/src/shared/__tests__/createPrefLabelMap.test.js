import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { createPrefLabelMap } from '../createPrefLabelMap'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('createPrefLabelMap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when the SPARQL request is successful', () => {
    test('should return a Map with concept IDs and their preferred labels', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                concept: { value: 'http://example.com/concept1' },
                prefLabel: { value: 'Label 1' }
              },
              {
                concept: { value: 'http://example.com/concept2' },
                prefLabel: { value: 'Label 2' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createPrefLabelMap()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get('concept1')).toBe('Label 1')
      expect(result.get('concept2')).toBe('Label 2')
    })
  })

  describe('when the SPARQL request fails', () => {
    test('should throw an error', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(createPrefLabelMap()).rejects.toThrow('HTTP error! status: 500')
    })
  })

  describe('when parsing the response fails', () => {
    test('should throw an error', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Parsing error'))
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(createPrefLabelMap()).rejects.toThrow('Parsing error')
    })
  })

  describe('when the SPARQL request throws an error', () => {
    test('should throw the error', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(createPrefLabelMap()).rejects.toThrow('Network error')
    })
  })
})
