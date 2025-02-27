import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { deleteTriples } from '../deleteTriples'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../sparqlRequest')

describe('deleteTriples', () => {
  const mockConceptIRI = 'https://example.com/concept/123'
  const mockDeletedTriples = [
    {
      s: { value: mockConceptIRI },
      p: { value: 'predicate1' },
      o: { value: 'object1' }
    },
    {
      s: { value: mockConceptIRI },
      p: { value: 'predicate2' },
      o: { value: 'object2' }
    }
  ]

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetAllMocks()
  })

  describe('when successful', () => {
    beforeEach(() => {
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: { bindings: mockDeletedTriples } })
      })

      sparqlRequest.mockResolvedValueOnce({ ok: true })
    })

    test('should successfully delete triples', async () => {
      const result = await deleteTriples(mockConceptIRI)

      expect(sparqlRequest).toHaveBeenCalledTimes(2)
      expect(sparqlRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        method: 'POST',
        body: expect.stringContaining('SELECT DISTINCT ?s ?p ?o')
      }))

      expect(sparqlRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
        type: 'update',
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        method: 'POST',
        body: expect.stringContaining('DELETE')
      }))

      expect(result).toEqual({
        deletedTriples: mockDeletedTriples,
        deleteResponse: { ok: true }
      })
    })

    test('should handle empty result from select query', async () => {
      sparqlRequest.mockReset()
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: { bindings: [] } })
      })

      sparqlRequest.mockResolvedValueOnce({ ok: true })

      const result = await deleteTriples(mockConceptIRI)

      expect(result).toEqual({
        deletedTriples: [],
        deleteResponse: { ok: true }
      })
    })

    test('should use correct SPARQL queries', async () => {
      await deleteTriples(mockConceptIRI)

      const selectCall = sparqlRequest.mock.calls[0][0]
      const deleteCall = sparqlRequest.mock.calls[1][0]

      expect(selectCall.body).toContain('SELECT DISTINCT ?s ?p ?o')
      expect(selectCall.body).toContain(`<${mockConceptIRI}> ?p ?o`)
      expect(selectCall.body).toContain(`BIND(<${mockConceptIRI}> AS ?s)`)
      expect(selectCall.body).toContain('UNION')
      expect(selectCall.body).toContain('FILTER(isBlank(?bnode))')

      expect(deleteCall.body).toContain('DELETE {')
      expect(deleteCall.body).toContain('WHERE {')
      expect(deleteCall.body).toContain(`<${mockConceptIRI}>`)
    })

    test('should handle large number of triples', async () => {
      sparqlRequest.mockReset()
      const largeNumberOfTriples = Array(1000).fill().map((_, i) => ({
        s: { value: mockConceptIRI },
        p: { value: `predicate${i}` },
        o: { value: `object${i}` }
      }))

      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: { bindings: largeNumberOfTriples } })
      })

      sparqlRequest.mockResolvedValueOnce({ ok: true })

      const result = await deleteTriples(mockConceptIRI)

      expect(result.deletedTriples).toHaveLength(1000)
      expect(sparqlRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('when unsuccessful', () => {
    test('should throw error if select query fails', async () => {
      sparqlRequest.mockResolvedValueOnce({
        ok: false,
        status: 400
      })

      await expect(deleteTriples(mockConceptIRI)).rejects.toThrow('HTTP error! select status: 400')
      expect(sparqlRequest).toHaveBeenCalledTimes(1)
    })

    test('should throw error if delete query fails', async () => {
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: { bindings: mockDeletedTriples } })
      })

      sparqlRequest.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(deleteTriples(mockConceptIRI)).rejects.toThrow('HTTP error! delete status: 500')
      expect(sparqlRequest).toHaveBeenCalledTimes(2)
    })

    test('should propagate unexpected errors', async () => {
      const mockError = new Error('Unexpected error')
      sparqlRequest.mockRejectedValueOnce(mockError)

      await expect(deleteTriples(mockConceptIRI)).rejects.toThrow('Unexpected error')
    })
  })
})
