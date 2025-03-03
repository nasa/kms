import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { createDefinitionsMap } from '../createDefinitionsMap'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('createDefinitionsMap', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when the SPARQL request is successful', () => {
    test('should return a Map with concept IDs and their definition objects', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                concept: { value: 'http://example.com/concept1' },
                definition: { value: 'Definition 1' },
                reference: { value: 'Reference 1' }
              },
              {
                concept: { value: 'http://example.com/concept2' },
                definition: { value: 'Definition 2' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createDefinitionsMap()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get('concept1')).toEqual({
        text: 'Definition 1',
        reference: 'Reference 1'
      })

      expect(result.get('concept2')).toEqual({
        text: 'Definition 2',
        reference: ''
      })
    })
  })

  describe('when the SPARQL request fails', () => {
    test('should throw an error', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(createDefinitionsMap()).rejects.toThrow('HTTP error! status: 500')
    })
  })

  describe('when parsing the response fails', () => {
    test('should throw an error', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Parsing error'))
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(createDefinitionsMap()).rejects.toThrow('Parsing error')
    })
  })

  describe('when the SPARQL request throws an error', () => {
    test('should throw the error', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(createDefinitionsMap()).rejects.toThrow('Network error')
    })
  })

  describe('when a concept has no reference', () => {
    test('should set an empty string as reference', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                concept: { value: 'http://example.com/concept1' },
                definition: { value: 'Definition 1' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await createDefinitionsMap()

      expect(result.get('concept1')).toEqual({
        text: 'Definition 1',
        reference: ''
      })
    })
  })
})
