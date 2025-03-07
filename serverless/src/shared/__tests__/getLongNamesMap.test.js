// Serverless/src/shared/getLongNamesMap.test.js

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { getLongNamesMap } from '../getLongNamesMap'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('getLongNamesMap', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  it('should return a map of subject values to long names', async () => {
    // Mock the response from sparqlRequest
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              subject: { value: 'http://example.com/person/1' },
              longName: { value: 'John Doe' }
            },
            {
              subject: { value: 'http://example.com/person/2' },
              longName: { value: 'Jane Smith' }
            }
          ]
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getLongNamesMap('person')

    expect(result).toEqual({
      'http://example.com/person/1': 'John Doe',
      'http://example.com/person/2': 'Jane Smith'
    })

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: expect.any(String)
    })
  })

  it('should throw an error when the response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getLongNamesMap('person')).rejects.toThrow('HTTP error! status: 500')
  })

  it('should handle and re-throw errors from sparqlRequest', async () => {
    const mockError = new Error('Network error')
    sparqlRequest.mockRejectedValue(mockError)

    await expect(getLongNamesMap('person')).rejects.toThrow('Network error')
  })
})
