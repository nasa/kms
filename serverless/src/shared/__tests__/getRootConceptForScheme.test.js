import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import {
  getRootConceptsBySchemeQuery
} from '@/shared/operations/queries/getRootConceptsBySchemeQuery'

import { getRootConceptForScheme } from '../getRootConceptForScheme'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest and getRootConceptsBySchemeQuery functions
vi.mock('../sparqlRequest')
vi.mock('@/shared/operations/queries/getRootConceptsBySchemeQuery')

describe('getRootConcept', () => {
  const mockScheme = 'http://example.com/scheme'
  const mockQuery = 'SPARQL query'
  const mockResponse = {
    ok: true,
    json: vi.fn()
  }

  beforeEach(() => {
    getRootConceptsBySchemeQuery.mockReturnValue(mockQuery)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should return the root concept when successful', async () => {
    const mockResult = {
      results: {
        bindings: [{ concept: 'root concept' }]
      }
    }
    mockResponse.json.mockResolvedValue(mockResult)
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getRootConceptForScheme(mockScheme, 'published')

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: mockQuery,
      version: 'published'
    }))

    expect(getRootConceptsBySchemeQuery).toHaveBeenCalledWith(mockScheme, 'published')
    expect(result).toEqual([{ concept: 'root concept' }])
  })

  test('should throw an error when the response is not ok', async () => {
    mockResponse.ok = false
    mockResponse.status = 500
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getRootConceptForScheme(mockScheme)).rejects.toThrow('HTTP error! status: 500')
  })

  test('should throw an error when no root concept is found', async () => {
    const mockResult = {
      results: {
        bindings: []
      }
    }
    mockResponse.ok = true// Ensure the response is ok
    mockResponse.json.mockResolvedValue(mockResult)
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getRootConceptForScheme(mockScheme)).rejects.toThrow(`No root concept found for scheme: ${mockScheme}`)
  })

  test('should throw an error when sparqlRequest fails', async () => {
    const mockError = new Error('Network error')
    sparqlRequest.mockRejectedValue(mockError)

    await expect(getRootConceptForScheme(mockScheme)).rejects.toThrow('Network error')
  })
})
