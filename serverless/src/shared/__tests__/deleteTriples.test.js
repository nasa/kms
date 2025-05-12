import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  getDeleteTriplesForConceptQuery
} from '@/shared/operations/updates/getDeleteTriplesForConceptQuery'

import { deleteTriples } from '../deleteTriples'
import { sparqlRequest } from '../sparqlRequest'

// Mock the sparqlRequest function
vi.mock('../sparqlRequest')
vi.mock('@/shared/operations/updates/getDeleteTriplesForConceptQuery')

describe('deleteTriples', () => {
  const mockConceptIRI = 'https://example.com/concept/123'
  const mockVersion = 'draft'
  const mockTransactionUrl = 'http://example.com/transaction/456'

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetAllMocks()
    getDeleteTriplesForConceptQuery.mockReturnValue('MOCK DELETE QUERY')
  })

  describe('when successful', () => {
    beforeEach(() => {
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: expect.any(Function)
      })

      sparqlRequest.mockResolvedValueOnce({ ok: true })
    })

    test('should successfully delete triples', async () => {
      const mockDeleteResponse = {
        ok: true,
        json: expect.any(Function)
      }
      sparqlRequest.mockResolvedValue(mockDeleteResponse)

      const response = await deleteTriples(mockConceptIRI, mockVersion, mockTransactionUrl)

      expect(sparqlRequest).toHaveBeenCalledWith({
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        path: '/statements',
        method: 'PUT',
        body: 'MOCK DELETE QUERY',
        version: mockVersion,
        transaction: {
          transactionUrl: mockTransactionUrl,
          action: 'UPDATE'
        }
      })

      expect(response).toEqual(mockDeleteResponse)
      expect(response.ok).toBe(true)
    })
  })

  describe('when unsuccessful', () => {
    test('should throw error if delete query fails', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500
      }
      sparqlRequest.mockResolvedValue(mockErrorResponse)

      await expect(deleteTriples(mockConceptIRI, mockVersion, mockTransactionUrl))
        .rejects.toThrow('HTTP error! delete status: 500')
    })

    test('should propagate unexpected errors', async () => {
      const mockError = new Error('Unexpected error')
      sparqlRequest.mockRejectedValueOnce(mockError)

      await expect(deleteTriples(mockConceptIRI)).rejects.toThrow('Unexpected error')
    })
  })
})
