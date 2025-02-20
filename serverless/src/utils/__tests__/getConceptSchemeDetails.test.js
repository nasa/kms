import {
  describe,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getConceptSchemeDetails from '../getConceptSchemeDetails'
import * as sparqlRequestModule from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('getConceptSchemeDetails', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('should return concept scheme details when found', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              prefLabel: { value: 'Chained Operations' },
              notation: { value: 'ChainedOperations' },
              modified: { value: '2025-01-31' },
              csvHeaders: { value: 'Header1,Header2' }
            }
          ]
        }
      })
    }

    sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getConceptSchemeDetails('ChainedOperations')

    expect(result).toEqual({
      prefLabel: 'Chained Operations',
      notation: 'ChainedOperations',
      modified: '2025-01-31',
      csvHeaders: 'Header1,Header2'
    })

    expect(sparqlRequestModule.sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json'
    }))
  })

  test('should return null when concept scheme is not found', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }

    sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getConceptSchemeDetails('NonExistentScheme')

    expect(result).toBeNull()
  })

  test('should throw an error when HTTP request fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }

    sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getConceptSchemeDetails('ChainedOperations')).rejects.toThrow('HTTP error! status: 500')
  })

  test('should handle concept scheme without csvHeaders', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              prefLabel: { value: 'Test Scheme' },
              notation: { value: 'TestScheme' },
              modified: { value: '2025-01-31' }
            }
          ]
        }
      })
    }

    sparqlRequestModule.sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getConceptSchemeDetails('TestScheme')

    expect(result).toEqual({
      prefLabel: 'Test Scheme',
      notation: 'TestScheme',
      modified: '2025-01-31',
      csvHeaders: null
    })
  })
})
