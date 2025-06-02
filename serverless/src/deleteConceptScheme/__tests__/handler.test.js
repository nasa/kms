import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import * as deleteTriples from '@/shared/deleteTriples'
import * as getConceptSchemeDetails from '@/shared/getConceptSchemeDetails'
import * as getSkosRootConcept from '@/shared/getSkosRootConcept'
import * as transactionHelpers from '@/shared/transactionHelpers'

import { deleteConceptScheme } from '../handler'

vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getSkosRootConcept')
vi.mock('@/shared/deleteTriples')
vi.mock('@/shared/transactionHelpers')

describe('deleteConceptScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  test('When scheme is not found, should return a 404 response', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue(null)

    const event = {
      pathParameters: { schemeId: 'nonexistent' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toEqual({ error: 'Scheme not found' })
  })

  test('When root concept has narrower concepts, should return a 422 response', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({})
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({
      'skos:narrower': ['someConcept']
    })

    const event = {
      pathParameters: { schemeId: 'testScheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(422)
    expect(JSON.parse(result.body)).toEqual({ error: "Scheme can't be deleted: Root concept has narrowers." })
  })

  test('When deletion is successful, should return a 200 response', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({})
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({
      '@rdf:about': 'testConcept',
      'skos:narrower': []
    })

    deleteTriples.deleteTriples.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('mockTransactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'testScheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toEqual({ message: 'Successfully deleted concept scheme: testScheme' })
  })

  test('When an error occurs during deletion, should rollback and return a 500 response', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({})
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({
      '@rdf:about': 'testConcept',
      'skos:narrower': []
    })

    deleteTriples.deleteTriples.mockRejectedValue(new Error('Deletion failed'))
    transactionHelpers.startTransaction.mockResolvedValue('mockTransactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'testScheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Deletion failed' })
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('mockTransactionUrl')
  })

  test('When no version is provided, should use "draft" as default', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({})
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({
      '@rdf:about': 'testConcept',
      'skos:narrower': []
    })

    deleteTriples.deleteTriples.mockResolvedValue({ ok: true })
    transactionHelpers.startTransaction.mockResolvedValue('mockTransactionUrl')
    transactionHelpers.commitTransaction.mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'testScheme' },
      queryStringParameters: {}
    }

    await deleteConceptScheme(event)

    expect(getConceptSchemeDetails.getConceptSchemeDetails).toHaveBeenCalledWith({
      schemeName: 'testScheme',
      version: 'draft'
    })
  })

  test('When deleting scheme triples fails, should throw an error', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({})
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({
      '@rdf:about': 'testConcept',
      'skos:narrower': []
    })

    deleteTriples.deleteTriples.mockResolvedValueOnce({ ok: false })
    transactionHelpers.startTransaction.mockResolvedValue('mockTransactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'testScheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Failed to delete existing scheme' })
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('mockTransactionUrl')
  })

  test('When deleting root concept triples fails, should throw an error', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({})
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({
      '@rdf:about': 'testConcept',
      'skos:narrower': []
    })

    deleteTriples.deleteTriples
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })

    transactionHelpers.startTransaction.mockResolvedValue('mockTransactionUrl')
    transactionHelpers.rollbackTransaction.mockResolvedValue()

    const event = {
      pathParameters: { schemeId: 'testScheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Failed to delete existing root concept' })
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('mockTransactionUrl')
  })

  test('When rollback fails, should log both the deletion error and the rollback error', async () => {
    getConceptSchemeDetails.getConceptSchemeDetails.mockResolvedValue({})
    getSkosRootConcept.getSkosRootConcept.mockResolvedValue({
      '@rdf:about': 'testConcept',
      'skos:narrower': []
    })

    deleteTriples.deleteTriples.mockRejectedValue(new Error('Deletion failed'))
    transactionHelpers.startTransaction.mockResolvedValue('mockTransactionUrl')
    transactionHelpers.rollbackTransaction.mockRejectedValue(new Error('Rollback failed'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const event = {
      pathParameters: { schemeId: 'testScheme' },
      queryStringParameters: { version: 'draft' }
    }

    const result = await deleteConceptScheme(event)

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({ error: 'Error: Deletion failed' })
    expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('mockTransactionUrl')

    // Check the first console.error call (deletion error)
    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'Error deleting concept scheme, error=Error: Deletion failed')

    // Check the second console.error call (rollback error)
    expect(consoleSpy).toHaveBeenNthCalledWith(2, 'Error rolling back transaction:', expect.any(Error))

    // Check that the rollback error message is correct
    const rollbackError = consoleSpy.mock.calls[1][1]
    expect(rollbackError).toBeInstanceOf(Error)
    expect(rollbackError.message).toBe('Rollback failed')

    expect(consoleSpy).toHaveBeenCalledTimes(2)

    consoleSpy.mockRestore()
  })
})
