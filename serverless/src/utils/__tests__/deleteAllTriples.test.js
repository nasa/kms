import {
  describe,
  expect,
  vi,
  beforeEach
} from 'vitest'
import deleteAllTriples from '../deleteAllTriples'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('deleteAllTriples', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('should return the result of sparqlRequest', async () => {
    const mockResponse = { ok: true }
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await deleteAllTriples()

    expect(result).toBe(mockResponse)
  })

  test('should throw an error if sparqlRequest fails', async () => {
    const error = new Error('SPARQL request failed')
    sparqlRequest.mockRejectedValue(error)

    await expect(deleteAllTriples()).rejects.toThrow('SPARQL request failed')
  })

  test('should not catch errors thrown by sparqlRequest', async () => {
    const error = new Error('SPARQL request failed')
    sparqlRequest.mockRejectedValue(error)

    await expect(deleteAllTriples()).rejects.toThrow('SPARQL request failed')
  })

  test('should call sparqlRequest with correct parameters', async () => {
    const expectedQuery = `
      DELETE {
        ?s ?p ?o
      }
      WHERE {
        ?s ?p ?o
      }
    `.trim().replace(/\s+/g, ' ')

    sparqlRequest.mockResolvedValue({ ok: true })

    await deleteAllTriples()

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/statements',
        method: 'POST',
        contentType: 'application/sparql-update',
        body: expect.any(String)
      })
    )

    const actualBody = sparqlRequest.mock.calls[0][0].body.trim().replace(/\s+/g, ' ')
    expect(actualBody).toBe(expectedQuery)
  })
})
