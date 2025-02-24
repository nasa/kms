import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { rollback } from '../rollback'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../sparqlRequest', () => ({
  sparqlRequest: vi.fn()
}))

describe('rollback', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})

  const mockDeletedTriples = [
    {
      s: { value: 'http://example.com/subject1' },
      p: { value: 'http://example.com/predicate1' },
      o: {
        type: 'uri',
        value: 'http://example.com/object1'
      }
    },
    {
      s: { value: 'http://example.com/subject2' },
      p: { value: 'http://example.com/predicate2' },
      o: {
        type: 'literal',
        value: 'Literal value'
      }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when successful', () => {
    test('should successfully rollback when sparqlRequest is successful', async () => {
      sparqlRequest.mockResolvedValue({ ok: true })

      await expect(rollback(mockDeletedTriples)).resolves.not.toThrow()

      expect(sparqlRequest).toHaveBeenCalledTimes(1)
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        path: '/statements',
        method: 'POST',
        body: expect.stringContaining('INSERT DATA')
      }))
    })

    test('should construct correct SPARQL query from deletedTriples', async () => {
      sparqlRequest.mockResolvedValue({ ok: true })

      await rollback(mockDeletedTriples)

      const expectedQueryParts = [
        'INSERT DATA {',
        '<http://example.com/subject1> <http://example.com/predicate1> <http://example.com/object1> .',
        '<http://example.com/subject2> <http://example.com/predicate2> "Literal value" .',
        '}'
      ]

      expect(sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(expectedQueryParts[0])
        })
      )

      expectedQueryParts.forEach((part) => {
        expect(sparqlRequest.mock.calls[0][0].body).toContain(part)
      })
    })

    test('should handle empty deletedTriples array', async () => {
      sparqlRequest.mockResolvedValue({ ok: true })

      await expect(rollback([])).resolves.not.toThrow()

      expect(sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('INSERT DATA {')
        })
      )
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error when sparqlRequest fails', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(rollback(mockDeletedTriples)).rejects.toThrow('Rollback failed! status: 500')

      expect(sparqlRequest).toHaveBeenCalledTimes(1)
    })
  })
})
