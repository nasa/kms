import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getVersionNames } from '../getVersionNames'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('getVersionNames', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  test('should return an array of version names when successful', async () => {
    // Mock successful response
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            { versionName: { value: 'v1.0' } },
            { versionName: { value: 'v2.0' } }
          ]
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getVersionNames()
    expect(result).toEqual(['v1.0', 'v2.0'])
    expect(sparqlRequest).toHaveBeenCalledTimes(1)
  })

  test('should throw an error when the response is not ok', async () => {
    // Mock unsuccessful response
    const mockResponse = {
      ok: false,
      status: 404
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getVersionNames()).rejects.toThrow('HTTP error! status: 404')
  })

  test('should throw an error when no versions are found', async () => {
    // Mock response with no results
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getVersionNames()).rejects.toThrow('No versions found')
  })

  test('should log and re-throw any errors during the process', async () => {
    // Mock a network error
    const mockError = new Error('Network error')
    sparqlRequest.mockRejectedValue(mockError)

    console.error = vi.fn() // Mock console.error

    await expect(getVersionNames()).rejects.toThrow('Network error')
    expect(console.error).toHaveBeenCalledWith('Error fetching version names concepts:', mockError)
  })
})
