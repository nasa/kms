import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { sparqlRequest } from '@/shared/sparqlRequest'

import { captureRelations } from '../captureRelations'

// Mock the sparqlRequest function
vi.mock('@/shared/sparqlRequest')

describe('captureRelations', () => {
  const mockConceptId = '123e4567-e89b-12d3-a456-426614174000'
  const mockVersion = 'draft'
  const mockTransactionUrl = 'http://example.com/transaction/1'

  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('should capture outgoing and incoming relations', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              from: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` },
              relation: { value: 'http://www.w3.org/2004/02/skos/core#broader' },
              to: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/456' }
            },
            {
              from: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/789' },
              relation: { value: 'http://www.w3.org/2004/02/skos/core#narrower' },
              to: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` }
            }
          ]
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await captureRelations(mockConceptId, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: expect.any(String),
      version: mockVersion,
      transaction: {
        transactionUrl: mockTransactionUrl,
        action: 'QUERY'
      }
    })

    expect(result).toEqual([
      {
        from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
      },
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
        relation: 'narrower',
        to: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`
      }
    ])
  })

  test('should handle empty result set', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await captureRelations(mockConceptId, mockVersion)

    expect(result).toEqual([])
  })

  test('should throw error on failed request', async () => {
    const mockResponse = {
      ok: false,
      status: 500
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(captureRelations(mockConceptId, mockVersion)).rejects.toThrow('Failed to fetch relations: 500')
  })

  test('should handle transaction URL correctly', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await captureRelations(mockConceptId, mockVersion, mockTransactionUrl)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      transaction: {
        transactionUrl: mockTransactionUrl,
        action: 'QUERY'
      }
    }))
  })

  test('should handle null transaction URL correctly', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await captureRelations(mockConceptId, mockVersion, null)

    expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
      transaction: null
    }))
  })

  test('should extract relation name correctly', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              from: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` },
              relation: { value: 'http://gcmd.nasa.gov/schema/gcmd#hasInstrument' },
              to: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/456' }
            }
          ]
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await captureRelations(mockConceptId, mockVersion)

    expect(result[0].relation).toBe('hasInstrument')
  })

  test('should handle all types of relations', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            {
              from: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` },
              relation: { value: 'http://www.w3.org/2004/02/skos/core#broader' },
              to: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/1' }
            },
            {
              from: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` },
              relation: { value: 'http://www.w3.org/2004/02/skos/core#narrower' },
              to: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/2' }
            },
            {
              from: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` },
              relation: { value: 'http://www.w3.org/2004/02/skos/core#related' },
              to: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/3' }
            },
            {
              from: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` },
              relation: { value: 'http://gcmd.nasa.gov/schema/gcmd#hasInstrument' },
              to: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/4' }
            },
            {
              from: { value: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}` },
              relation: { value: 'http://gcmd.nasa.gov/schema/gcmd#isOnPlatform' },
              to: { value: 'https://gcmd.earthdata.nasa.gov/kms/concept/5' }
            }
          ]
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    const result = await captureRelations(mockConceptId, mockVersion)

    expect(result).toHaveLength(5)
    expect(result.map((r) => r.relation)).toEqual(['broader', 'narrower', 'related', 'hasInstrument', 'isOnPlatform'])
  })

  test('should handle malformed SPARQL response', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        // Missing 'results' key
        bindings: []
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await expect(captureRelations(mockConceptId, mockVersion)).rejects.toThrow()
  })

  test('should handle network errors', async () => {
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    await expect(captureRelations(mockConceptId, mockVersion)).rejects.toThrow('Network error')
  })

  test('should use correct SPARQL query', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: []
        }
      })
    }

    sparqlRequest.mockResolvedValue(mockResponse)

    await captureRelations(mockConceptId, mockVersion)

    const expectedQueryParts = [
      'PREFIX skos: <http://www.w3.org/2004/02/skos/core#>',
      'PREFIX gcmd: <http://gcmd.nasa.gov/schema/gcmd#>',
      'SELECT ?from ?relation ?to',
      `<https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}> ?relation ?to`,
      `?from ?relation <https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}>`,
      'FILTER(?relation IN (skos:broader, skos:narrower, skos:related, gcmd:hasInstrument, gcmd:isOnPlatform))'
    ]

    const calledQuery = sparqlRequest.mock.calls[0][0].body

    expectedQueryParts.forEach((part) => {
      expect(calledQuery).toContain(part)
    })
  })
})
