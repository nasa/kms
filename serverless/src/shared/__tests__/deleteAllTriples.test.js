import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { deleteAllTriples } from '../deleteAllTriples'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')

describe('deleteAllTriples', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('when successful', () => {
    beforeEach(() => {
      sparqlRequest.mockResolvedValue({ ok: true })
    })

    test('should return the result of sparqlRequest', async () => {
      const result = await deleteAllTriples()

      expect(result).toEqual({ ok: true })
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

      await deleteAllTriples()

      expect(sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update',
          method: 'POST',
          contentType: 'application/sparql-update',
          body: expect.any(String)
        })
      )

      const actualBody = sparqlRequest.mock.calls[0][0].body.trim().replace(/\s+/g, ' ')
      expect(actualBody).toBe(expectedQuery)
    })
  })

  describe('when unsuccessful', () => {
    beforeEach(() => {
      sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))
    })

    test('should throw an error if sparqlRequest fails', async () => {
      await expect(deleteAllTriples()).rejects.toThrow('SPARQL request failed')
    })

    test('should not catch errors thrown by sparqlRequest', async () => {
      await expect(deleteAllTriples()).rejects.toThrow('SPARQL request failed')
    })
  })
})
