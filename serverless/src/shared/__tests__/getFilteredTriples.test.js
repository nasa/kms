import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { logger } from '@/shared/logger'
import { getConceptsQuery } from '@/shared/operations/queries/getConceptsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/operations/queries/getConceptsQuery')
vi.mock('@/shared/logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

describe('getFilteredTriples', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    sparqlRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: { bindings: [] } })
    })

    getConceptsQuery.mockReturnValue('MOCK_CONCEPTS_QUERY')
  })

  describe('when successful', () => {
    test('should call sparqlRequest with correct parameters', async () => {
      await getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        pattern: 'snow',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })

      expect(sparqlRequest).toHaveBeenCalledTimes(1)
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        body: 'MOCK_CONCEPTS_QUERY',
        version: 'published'
      })
    })

    test('should use correct parameters for concepts query', async () => {
      await getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        pattern: 'snow',
        version: 'published',
        pageNum: 2,
        pageSize: 20
      })

      expect(getConceptsQuery).toHaveBeenCalledWith('sciencekeywords', 'snow', 20, 20) // PageSize, offset
    })

    test('should return the bindings from the SPARQL response', async () => {
      const mockBindings = [
        {
          s: { value: 'http://example.com/concept1' },
          p: { value: 'predicate1' },
          o: { value: 'object1' }
        },
        {
          s: { value: 'http://example.com/concept2' },
          p: { value: 'predicate2' },
          o: { value: 'object2' }
        }
      ]

      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: { bindings: mockBindings } })
      })

      const result = await getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })

      expect(result).toEqual(mockBindings)
    })
  })

  describe('when unsuccessful', () => {
    test('should handle error from SPARQL request', async () => {
      sparqlRequest.mockRejectedValueOnce(new Error('SPARQL request failed'))

      await expect(getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })).rejects.toThrow('SPARQL request failed')

      expect(logger.error).toHaveBeenCalledWith('Error fetching triples:', expect.any(Error))
    })

    test('should handle non-ok response from SPARQL request', async () => {
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

      expect(logger.error).toHaveBeenCalledWith('Error fetching triples:', expect.any(Error))
    })

    test('should handle JSON parsing error', async () => {
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      await expect(getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })).rejects.toThrow('Invalid JSON')

      expect(logger.error).toHaveBeenCalledWith('Error fetching triples:', expect.any(Error))
    })

    test('should calculate offset correctly', async () => {
      await getFilteredTriples({
        conceptScheme: 'sciencekeywords',
        version: 'published',
        pageNum: 3,
        pageSize: 15
      })

      expect(getConceptsQuery).toHaveBeenCalledWith('sciencekeywords', undefined, 15, 30) // PageSize, offset
    })

    test('should handle missing optional parameters', async () => {
      await getFilteredTriples({
        version: 'published',
        pageNum: 1,
        pageSize: 10
      })

      expect(getConceptsQuery).toHaveBeenCalledWith(undefined, undefined, 10, 0)
    })
  })
})
