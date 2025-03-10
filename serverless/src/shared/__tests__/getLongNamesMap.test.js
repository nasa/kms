// Serverless/src/shared/getLongNamesMap.test.js

import {
  beforeEach,
  describe,
  expect,
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
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('should return a map of subject values to long names', async () => {
    // Mock the response from sparqlRequest
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              subject: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/d77685bd-aa94-4717-bd97-632699d999b5' },
              longName: { value: 'Dassault HU-25A Guardian' }
            },
            {
              subject: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/879d697c-381f-45df-a48d-2d9095bc5c54' },
              longName: { value: 'NSF/NCAR Gulfstream GV Aircraft' }
            }
          ]
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getLongNamesMap('person')

    expect(result).toEqual({
      'https://gcmd.earthdata.nasa.gov/kms/concept/d77685bd-aa94-4717-bd97-632699d999b5': 'Dassault HU-25A Guardian',
      'https://gcmd.earthdata.nasa.gov/kms/concept/879d697c-381f-45df-a48d-2d9095bc5c54': 'NSF/NCAR Gulfstream GV Aircraft'
    })

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: expect.any(String)
    })
  })

  test('should throw an error when the response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getLongNamesMap('person')).rejects.toThrow('HTTP error! status: 500')
  })

  test('should handle and re-throw errors from sparqlRequest', async () => {
    const mockError = new Error('Network error')
    sparqlRequest.mockRejectedValue(mockError)

    await expect(getLongNamesMap('person')).rejects.toThrow('Network error')
  })
})
