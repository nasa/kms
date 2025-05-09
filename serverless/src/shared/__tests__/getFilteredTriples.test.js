import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { getConceptDetailsQuery } from '@/shared/operations/queries/getConceptDetailsQuery'
import { getConceptUrisQuery } from '@/shared/operations/queries/getConceptUrisQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

vi.mock('../sparqlRequest')
vi.mock('../operations/queries/getConceptUrisQuery')
vi.mock('../operations/queries/getConceptDetailsQuery')

describe('when fetching triples for a query', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: { bindings: [] } })
    })

    getConceptUrisQuery.mockReturnValue('MOCK_URI_QUERY')
    getConceptDetailsQuery.mockReturnValue('MOCK_DETAILS_QUERY')
  })

  describe('when successful', () => {
    test('should call sparqlRequest for both uri query and details query', async () => {
      const mockUris = [
        { s: { value: 'http://example.com/concept1' } },
        { s: { value: 'http://example.com/concept2' } }
      ]

      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: { bindings: mockUris } })
      })

      await getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        pattern: 'snow',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })

      expect(sparqlRequest).toHaveBeenCalledTimes(2)

      // Check first call for URI query
      expect(sparqlRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
        body: 'MOCK_URI_QUERY',
        version: 'published'
      }))

      // Check second call for details query
      expect(sparqlRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
        body: 'MOCK_DETAILS_QUERY',
        version: 'published'
      }))
    })

    test('should use correct parameters for uris query', async () => {
      await getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        pattern: 'snow',
        version: 'published',
        pageNum: 2,
        pageSize: 20
      })

      expect(getConceptUrisQuery).toHaveBeenCalledWith({
        conceptScheme: 'sciencekeywords',
        pattern: 'snow',
        pageSize: 20,
        offset: 20 // (pageNum - 1) * pageSize
      })
    })

    test('should use fetched URIs for details query', async () => {
      const mockUris = [
        { s: { value: 'http://example.com/concept1' } },
        { s: { value: 'http://example.com/concept2' } }
      ]

      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: { bindings: mockUris } })
      })

      await getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })

      expect(getConceptDetailsQuery).toHaveBeenCalledWith([
        'http://example.com/concept1',
        'http://example.com/concept2'
      ])
    })
  })

  describe('when unsuccessful', () => {
    test('should handle error from uri query', async () => {
      sparqlRequest.mockRejectedValueOnce(new Error('SPARQL request failed'))

      await expect(getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })).rejects.toThrow('SPARQL request failed')
    })

    test('should handle non-ok response uri query', async () => {
      sparqlRequest.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })).rejects.toThrow('HTTP error! status: 500')
    })

    test('should handle error from details query call', async () => {
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [{ s: { value: 'http://example.com/concept1' } }] } })
      })

      sparqlRequest.mockRejectedValueOnce(new Error('SPARQL request failed'))

      await expect(getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })).rejects.toThrow('SPARQL request failed')
    })

    test('should handle non-ok response from details query', async () => {
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [{ s: { value: 'http://example.com/concept1' } }] } })
      })

      sparqlRequest.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })).rejects.toThrow('HTTP error! status: 500')
    })
  })
})
