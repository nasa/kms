import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { createShortNameMap } from '../createShortNameMap'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('createShortNameMap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when the SPARQL request is successful', () => {
    test('should return a Map with concept IDs and their scheme short names', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                concept: { value: 'http://example.com/concept1' },
                schemeShortName: { value: 'Scheme1' }
              },
              {
                concept: { value: 'http://example.com/concept2' },
                schemeShortName: { value: 'Scheme2' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createShortNameMap()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get('concept1')).toBe('Scheme1')
      expect(result.get('concept2')).toBe('Scheme2')
    })
  })

  describe('when the SPARQL request fails', () => {
    test('should throw an error', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(createShortNameMap()).rejects.toThrow('HTTP error! status: 500')
    })
  })

  describe('when parsing the response fails', () => {
    test('should throw an error', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Parsing error'))
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(createShortNameMap()).rejects.toThrow('Parsing error')
    })
  })

  describe('when the SPARQL request throws an error', () => {
    test('should throw the error', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(createShortNameMap()).rejects.toThrow('Network error')
    })
  })

  describe('when multiple concepts belong to the same scheme', () => {
    test('should correctly map each concept to its scheme', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                concept: { value: 'http://example.com/concept1' },
                schemeShortName: { value: 'Scheme1' }
              },
              {
                concept: { value: 'http://example.com/concept2' },
                schemeShortName: { value: 'Scheme1' }
              },
              {
                concept: { value: 'http://example.com/concept3' },
                schemeShortName: { value: 'Scheme2' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createShortNameMap()

      expect(result.size).toBe(3)
      expect(result.get('concept1')).toBe('Scheme1')
      expect(result.get('concept2')).toBe('Scheme1')
      expect(result.get('concept3')).toBe('Scheme2')
    })
  })
})
