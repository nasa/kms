// GetRootConcept.test.js
import {
  describe,
  expect,
  vi,
  afterEach
} from 'vitest'
import getRootConcept from '../getRootConcept'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('getRootConcept', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('returns root concept when found', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              subject: { value: 'http://example.com/rootConcept' },
              prefLabel: { value: 'Root Concept' }
            }
          ]
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getRootConcept('testScheme')

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: expect.any(String)
    })

    expect(result).toEqual({
      subject: { value: 'http://example.com/rootConcept' },
      prefLabel: { value: 'Root Concept' }
    })
  })

  test('throws error when no root concept found', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getRootConcept('testScheme')).rejects.toThrow('No root concept found for scheme: testScheme')
  })

  test('throws error when HTTP request fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getRootConcept('testScheme')).rejects.toThrow('HTTP error! status: 500')
  })

  test('throws error when sparqlRequest throws', async () => {
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(getRootConcept('testScheme')).rejects.toThrow('Network error')
  })
})
