import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { getRootConceptQuery } from '@/shared/operations/queries/getRootConceptQuery'

import getRootConcept from '../getRootConcept'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest and getRootConceptQuery functions
vi.mock('../sparqlRequest')
vi.mock('@/shared/operations/queries/getRootConceptQuery')

describe('getRootConcept', () => {
  const mockScheme = 'http://example.com/scheme'
  const mockQuery = 'SPARQL query'
  const mockResponse = {
    ok: true,
    json: vi.fn()
  }

  beforeEach(() => {
    getRootConceptQuery.mockReturnValue(mockQuery)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return the root concept when successful', async () => {
    const mockResult = {
      results: {
        bindings: [{ concept: 'root concept' }]
      }
    }
    mockResponse.json.mockResolvedValue(mockResult)
    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await getRootConcept(mockScheme)

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: mockQuery
    })

    expect(getRootConceptQuery).toHaveBeenCalledWith(mockScheme)
    expect(result).toEqual({ concept: 'root concept' })
  })

  it('should throw an error when the response is not ok', async () => {
    mockResponse.ok = false
    mockResponse.status = 500
    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(getRootConcept(mockScheme)).rejects.toThrow('HTTP error! status: 500')
  })

  it('should throw an error when no root concept is found', async () => {
    const mockResult = {
      results: {
        bindings: []
      }
    }
    mockResponse.ok = true; // Ensure the response is ok
    mockResponse.json.mockResolvedValue(mockResult)
    sparqlRequest.mockResolvedValue(mockResponse)
  
    await expect(getRootConcept(mockScheme)).rejects.toThrow(`No root concept found for scheme: ${mockScheme}`)
  })

  it('should throw an error when sparqlRequest fails', async () => {
    const mockError = new Error('Network error')
    sparqlRequest.mockRejectedValue(mockError)

    await expect(getRootConcept(mockScheme)).rejects.toThrow('Network error')
  })
})
