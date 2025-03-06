import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getCsvHeaders } from '../getCsvHeaders'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('getCsvHeaders', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore all mocks after each test
    vi.restoreAllMocks()
  })

  describe('when successful', () => {
    test('should return an array of CSV headers', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              {
                csvHeaders: { value: 'header1,header2,header3' }
              }
            ]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getCsvHeaders('testScheme')
      expect(result).toEqual(['header1', 'header2', 'header3'])
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        body: expect.any(String)
      })
    })

    test('should return an empty array when no CSV headers are found', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [{}]
          }
        })
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await getCsvHeaders('testScheme')
      expect(result).toEqual([])
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error when the response is not ok', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      }

      sparqlRequest.mockResolvedValue(mockResponse)

      await expect(getCsvHeaders('testScheme')).rejects.toThrow('HTTP error! status: 404')
    })

    test('should throw an error when sparqlRequest fails', async () => {
      const mockError = new Error('Network error')
      sparqlRequest.mockRejectedValue(mockError)

      await expect(getCsvHeaders('testScheme')).rejects.toThrow('Network error')
    })
  })
})
