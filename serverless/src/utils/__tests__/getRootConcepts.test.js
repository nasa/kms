import {
  describe,
  test,
  expect,
  vi,
  beforeEach
} from 'vitest'
import getRootConcepts from '../getRootConcepts'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

// Mock console.error
console.error = vi.fn()

describe('getRootConcepts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('should fetch root concepts successfully', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              s: { value: 'concept1' },
              p: { value: 'predicate1' },
              o: { value: 'object1' }
            },
            {
              s: { value: 'concept2' },
              p: { value: 'predicate2' },
              o: { value: 'object2' }
            }
          ]
        }
      })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getRootConcepts()

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: expect.any(String)
    })

    expect(result).toEqual([
      {
        s: { value: 'concept1' },
        p: { value: 'predicate1' },
        o: { value: 'object1' }
      },
      {
        s: { value: 'concept2' },
        p: { value: 'predicate2' },
        o: { value: 'object2' }
      }
    ])
  })

  test('should throw an error when the response is not ok', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getRootConcepts()).rejects.toThrow('HTTP error! status: 500')
    expect(console.error).toHaveBeenCalledWith('Error fetching root concepts:', expect.any(Error))
  })

  test('should throw an error when sparqlRequest fails', async () => {
    const networkError = new Error('Network error')
    sparqlRequest.mockRejectedValue(networkError)

    await expect(getRootConcepts()).rejects.toThrow('Network error')
    expect(console.error).toHaveBeenCalledWith('Error fetching root concepts:', networkError)
  })

  test('should throw an error when json parsing fails', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockRejectedValue(new Error('JSON parse error'))
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getRootConcepts()).rejects.toThrow('JSON parse error')
    expect(console.error).toHaveBeenCalledWith('Error fetching root concepts:', expect.any(Error))
  })

  test('should include the correct SPARQL query', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ results: { bindings: [] } })
    }
    sparqlRequest.mockResolvedValue(mockResponse)

    await getRootConcepts()

    const expectedQuery = expect.stringContaining('PREFIX skos: <http://www.w3.org/2004/02/skos/core#>')
    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: expectedQuery
    }))
  })
})
