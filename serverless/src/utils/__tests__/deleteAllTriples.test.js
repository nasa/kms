import {
  describe,
  it,
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

  test('should call sparqlRequest with correct parameters', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await deleteAllTriples()

    expect(sparqlRequest).toHaveBeenCalledWith({
      path: '/statements',
      method: 'POST',
      contentType: 'application/sparql-update',
      body: expect.stringContaining('DELETE {\n      ?s ?p ?o\n    }\n    WHERE {\n      ?s ?p ?o\n    }')
    })
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

  test('should send the correct SPARQL query', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await deleteAllTriples()

    const expectedQuery = `
    DELETE {
      ?s ?p ?o
    }
    WHERE {
      ?s ?p ?o
    }
  `

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expectedQuery
      })
    )
  })
})
