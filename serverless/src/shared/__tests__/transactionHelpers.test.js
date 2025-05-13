import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { sparqlRequest } from '../sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '../transactionHelpers'

vi.mock('../sparqlRequest')

describe('transactionHelpers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('startTransaction', () => {
    test('should call sparqlRequest with correct parameters', async () => {
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue('http://example.com/transaction/123')
        }
      }
      sparqlRequest.mockResolvedValue(mockResponse)

      const result = await startTransaction()

      expect(sparqlRequest).toHaveBeenCalledWith({
        path: '/transactions',
        method: 'POST'
      })

      expect(result).toBe('http://example.com/transaction/123')
    })

    test('should throw an error if sparqlRequest fails', async () => {
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      await expect(startTransaction()).rejects.toThrow('Network error')
    })
  })

  describe('commitTransaction', () => {
    test('should call sparqlRequest with correct parameters', async () => {
      const transactionUrl = 'http://example.com/transaction/123'
      await commitTransaction(transactionUrl)

      expect(sparqlRequest).toHaveBeenCalledWith({
        transaction: {
          transactionUrl,
          action: 'COMMIT'
        },
        method: 'PUT'
      })
    })

    test('should throw an error if sparqlRequest fails', async () => {
      sparqlRequest.mockRejectedValue(new Error('Commit failed'))

      await expect(commitTransaction('http://example.com/transaction/123')).rejects.toThrow('Commit failed')
    })
  })

  describe('rollbackTransaction', () => {
    test('should call sparqlRequest with correct parameters', async () => {
      const transactionUrl = 'http://example.com/transaction/123'
      await rollbackTransaction(transactionUrl)

      expect(sparqlRequest).toHaveBeenCalledWith({
        transaction: {
          transactionUrl
        },
        method: 'DELETE'
      })
    })

    test('should throw an error if sparqlRequest fails', async () => {
      sparqlRequest.mockRejectedValue(new Error('Rollback failed'))

      await expect(rollbackTransaction('http://example.com/transaction/123')).rejects.toThrow('Rollback failed')
    })
  })
})
