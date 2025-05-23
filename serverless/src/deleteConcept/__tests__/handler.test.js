import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { deleteConcept } from '@/deleteConcept/handler'
import { conceptIdExists } from '@/shared/conceptIdExists'
import { deleteTriples } from '@/shared/deleteTriples'
import { ensureReciprocal } from '@/shared/ensureReciprocal'
import { getConceptById } from '@/shared/getConceptById'
import { getApplicationConfig } from '@/shared/getConfig'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'

// Mock the dependencies
vi.mock('@/shared/conceptIdExists')
vi.mock('@/shared/deleteTriples')
vi.mock('@/shared/ensureReciprocal')
vi.mock('@/shared/getConceptById')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/transactionHelpers')

describe('deleteConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockEvent = {
    pathParameters: { conceptId: '123' },
    queryStringParameters: { version: 'draft' }
  }
  const mockConceptIRI = 'https://gcmd.earthdata.nasa.gov/kms/concept/123'
  const mockOldRdfXml = '<rdf:RDF>old content</rdf:RDF>'
  const mockTransactionUrl = 'mock-transaction-url'

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    conceptIdExists.mockResolvedValue(true)
    getConceptById.mockResolvedValue(mockOldRdfXml)
    startTransaction.mockResolvedValue(mockTransactionUrl)
    deleteTriples.mockResolvedValue({ ok: true })
    ensureReciprocal.mockResolvedValue({ ok: true })
    commitTransaction.mockResolvedValue()
  })

  describe('when successful', () => {
    test('should successfully delete a concept', async () => {
      const result = await deleteConcept(mockEvent)

      expect(conceptIdExists).toHaveBeenCalledWith(mockConceptIRI, 'draft')
      expect(startTransaction).toHaveBeenCalled()
      expect(getConceptById).toHaveBeenCalledWith('123', 'draft')
      expect(ensureReciprocal).toHaveBeenCalledWith({
        oldRdfXml: mockOldRdfXml,
        newRdfXml: null,
        conceptId: '123',
        version: 'draft',
        transactionUrl: mockTransactionUrl
      })

      expect(deleteTriples).toHaveBeenCalledWith(mockConceptIRI, 'draft', mockTransactionUrl)
      expect(commitTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully deleted concept: 123' }),
        headers: mockDefaultHeaders
      })
    })

    test('should use provided version', async () => {
      const customVersion = 'published'
      const eventWithCustomVersion = {
        ...mockEvent,
        queryStringParameters: { version: customVersion }
      }

      await deleteConcept(eventWithCustomVersion)

      expect(conceptIdExists).toHaveBeenCalledWith(mockConceptIRI, customVersion)
      expect(getConceptById).toHaveBeenCalledWith('123', customVersion)
      expect(ensureReciprocal).toHaveBeenCalledWith(expect.objectContaining({ version: customVersion }))
      expect(deleteTriples).toHaveBeenCalledWith(mockConceptIRI, customVersion, mockTransactionUrl)
    })
  })

  describe('when handling transactions', () => {
    test('should start and commit transaction for successful deletion', async () => {
      await deleteConcept(mockEvent)

      expect(startTransaction).toHaveBeenCalled()
      expect(commitTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(rollbackTransaction).not.toHaveBeenCalled()
    })

    test('should rollback transaction if any operation fails', async () => {
      deleteTriples.mockResolvedValue({
        ok: false,
        status: 500
      })

      await deleteConcept(mockEvent)

      expect(startTransaction).toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(commitTransaction).not.toHaveBeenCalled()
    })

    test('should handle startTransaction failure', async () => {
      startTransaction.mockRejectedValue(new Error('Failed to start transaction'))

      const result = await deleteConcept(mockEvent)

      expect(getConceptById).not.toHaveBeenCalled()
      expect(ensureReciprocal).not.toHaveBeenCalled()
      expect(deleteTriples).not.toHaveBeenCalled()
      expect(commitTransaction).not.toHaveBeenCalled()
      expect(rollbackTransaction).not.toHaveBeenCalled()
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to start transaction')
    })
  })

  describe('when unsuccessful', () => {
    test('should return 404 if concept does not exist', async () => {
      conceptIdExists.mockResolvedValue(false)

      const result = await deleteConcept(mockEvent)

      expect(conceptIdExists).toHaveBeenCalledWith(mockConceptIRI, 'draft')
      expect(startTransaction).not.toHaveBeenCalled()
      expect(getConceptById).not.toHaveBeenCalled()
      expect(ensureReciprocal).not.toHaveBeenCalled()
      expect(deleteTriples).not.toHaveBeenCalled()
      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ message: 'Concept not found: 123' }),
        headers: mockDefaultHeaders
      })
    })

    test('should rollback transaction and return 500 if deleteTriples fails', async () => {
      deleteTriples.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await deleteConcept(mockEvent)

      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(commitTransaction).not.toHaveBeenCalled()
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error deleting concept',
          error: 'HTTP error! status: 500'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should rollback transaction and return 500 if ensureReciprocal fails', async () => {
      ensureReciprocal.mockRejectedValue(new Error('Failed to ensure reciprocal relations'))

      const result = await deleteConcept(mockEvent)

      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(deleteTriples).not.toHaveBeenCalled()
      expect(commitTransaction).not.toHaveBeenCalled()
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error deleting concept',
          error: 'Failed to ensure reciprocal relations'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle error when rolling back transaction fails', async () => {
      deleteTriples.mockResolvedValue({
        ok: false,
        status: 500
      })

      rollbackTransaction.mockRejectedValue(new Error('Rollback failed'))

      const consoleErrorSpy = vi.spyOn(console, 'error')

      await deleteConcept(mockEvent)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting concept:', expect.any(Error))
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    test('should handle missing conceptId', async () => {
      const eventWithoutConceptId = { pathParameters: {} }

      const result = await deleteConcept(eventWithoutConceptId)

      expect(result).toMatchObject({
        statusCode: 400,
        headers: mockDefaultHeaders
      })

      const body = JSON.parse(result.body)
      expect(body).toHaveProperty('message', 'Missing conceptId in path parameters')
    })
  })

  describe('when retrieving the existing rdf', () => {
    test('should call getConceptById with correct parameters', async () => {
      await deleteConcept(mockEvent)

      expect(getConceptById).toHaveBeenCalledWith('123', 'draft')
    })

    test('should handle getConceptById failure', async () => {
      getConceptById.mockRejectedValue(new Error('Failed to retrieve concept'))

      const result = await deleteConcept(mockEvent)

      expect(ensureReciprocal).not.toHaveBeenCalled()
      expect(deleteTriples).not.toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to retrieve concept')
    })
  })

  describe('when handingn reciprocal relationships', () => {
    test('should call ensureReciprocal with correct parameters', async () => {
      await deleteConcept(mockEvent)

      expect(ensureReciprocal).toHaveBeenCalledWith({
        oldRdfXml: mockOldRdfXml,
        newRdfXml: null,
        conceptId: '123',
        version: 'draft',
        transactionUrl: mockTransactionUrl
      })
    })

    test('should handle ensureReciprocal failure', async () => {
      ensureReciprocal.mockRejectedValue(new Error('Failed to ensure reciprocal relations'))

      const result = await deleteConcept(mockEvent)

      expect(deleteTriples).not.toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to ensure reciprocal relations')
    })
  })
})
