// GetConceptScheme.test.js

import { describe, expect } from 'vitest'
import getConceptScheme from '../getConceptScheme'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('getConceptScheme', () => {
  const mockConceptUri = 'https://gcmd.earthdata.nasa.gov/kms/concept/1234'
  const mockSchemeUri = 'https://gcmd.earthdata.nasa.gov/kms/concept/scheme/5678'

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore all mocks after each test
    vi.restoreAllMocks()
  })

  test('should return the concept scheme URI when found', async () => {
    // Mock successful response
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: [{ scheme: { value: mockSchemeUri } }]
        }
      })
    })

    const result = await getConceptScheme(mockConceptUri)
    expect(result).toBe(mockSchemeUri)
    expect(sparqlRequest).toHaveBeenCalledTimes(1)
  })

  test('should throw an error when no scheme is found', async () => {
    // Mock response with no scheme
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: {
          bindings: []
        }
      })
    })

    await expect(getConceptScheme(mockConceptUri)).rejects.toThrow('No scheme found for the given concept')
    expect(sparqlRequest).toHaveBeenCalledTimes(1)
  })

  test('should throw an error when the HTTP response is not ok', async () => {
    // Mock failed HTTP response
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 404
    })

    await expect(getConceptScheme(mockConceptUri)).rejects.toThrow('HTTP error! status: 404')
    expect(sparqlRequest).toHaveBeenCalledTimes(1)
  })

  test('should throw an error when sparqlRequest fails', async () => {
    // Mock sparqlRequest throwing an error
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(getConceptScheme(mockConceptUri)).rejects.toThrow('Network error')
    expect(sparqlRequest).toHaveBeenCalledTimes(1)
  })
})
