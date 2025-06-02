import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import * as getConceptSchemeDetails from '@/shared/getConceptSchemeDetails'
import * as getSchemeInfo from '@/shared/getSchemeInfo'
import * as sparqlRequest from '@/shared/sparqlRequest'
import * as transactionHelpers from '@/shared/transactionHelpers'

import { updateConceptScheme } from '../handler'

vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/getSchemeInfo')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/transactionHelpers')

describe('updateConceptScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('When called with valid input', () => {
    test('should successfully update the concept scheme', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'Test Scheme',
        csvHeaders: 'header1,header2'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Old Label',
        csvHeaders: 'oldHeader'
      })

      vi.spyOn(sparqlRequest, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'commitTransaction').mockResolvedValue()

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.body).message).toBe('Successfully updated concept scheme')
    })
  })

  describe('When called without RDF data', () => {
    test('should return an error', async () => {
      const mockEvent = {
        body: null,
        queryStringParameters: { version: 'draft' }
      }

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Missing RDF/XML data in request body')
    })
  })

  describe('When called with invalid scheme ID', () => {
    test('should return an error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: null
      })

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Invalid or missing scheme ID')
    })
  })

  describe('When the scheme does not exist', () => {
    test('should return a 409 error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue(null)

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(409)
      expect(JSON.parse(result.body).message).toBe('Scheme testScheme not found.')
    })
  })

  describe('When updating the prefLabel fails', () => {
    test('should rollback the transaction and return an error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'New Label'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Old Label'
      })

      vi.spyOn(sparqlRequest, 'sparqlRequest').mockResolvedValue({ ok: false })
      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'rollbackTransaction').mockResolvedValue()

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Failed to update scheme prefLabel')
      expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    })
  })

  describe('When updating the csvHeaders fails', () => {
    test('should not proceed to update modified date', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'New Label',
        csvHeaders: 'newHeader1,newHeader2'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Old Label',
        csvHeaders: 'oldHeader1,oldHeader2'
      })

      const sparqlRequestSpy = vi.spyOn(sparqlRequest, 'sparqlRequest')
        .mockResolvedValueOnce({ ok: true }) // For prefLabel update
        .mockResolvedValueOnce({ ok: false }) // For csvHeaders update

      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'rollbackTransaction').mockResolvedValue()

      await updateConceptScheme(mockEvent)

      expect(sparqlRequestSpy).toHaveBeenCalledTimes(2) // Only prefLabel and csvHeaders updates should be called
      expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    })
  })

  describe('When updating the modified date fails', () => {
    test('should rollback the transaction and return an error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'New Label'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Old Label'
      })

      vi.spyOn(sparqlRequest, 'sparqlRequest')
        .mockResolvedValueOnce({ ok: true }) // For prefLabel update
        .mockResolvedValueOnce({ ok: false }) // For modified date update

      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'rollbackTransaction').mockResolvedValue()

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Failed to update scheme modified date')
      expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    })
  })

  describe('When committing the transaction fails', () => {
    test('should return an error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'New Label'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Old Label'
      })

      vi.spyOn(sparqlRequest, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'commitTransaction').mockRejectedValue(new Error('Commit failed'))
      vi.spyOn(transactionHelpers, 'rollbackTransaction').mockResolvedValue()

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Commit failed')
      expect(transactionHelpers.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    })
  })

  describe('When rolling back the transaction fails', () => {
    test('should still return an error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'New Label'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Old Label'
      })

      vi.spyOn(sparqlRequest, 'sparqlRequest').mockResolvedValue({ ok: false })
      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'rollbackTransaction').mockRejectedValue(new Error('Rollback failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Failed to update scheme prefLabel')
      expect(consoleSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))
    })
  })

  describe('When no updates are needed', () => {
    test('should not update modified date and return success', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'Existing Label',
        csvHeaders: 'existingHeader1,existingHeader2'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Existing Label',
        csvHeaders: 'existingHeader1,existingHeader2'
      })

      vi.spyOn(sparqlRequest, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'commitTransaction').mockResolvedValue()

      const result = await updateConceptScheme(mockEvent)

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.body).message).toBe('Successfully updated concept scheme')
      expect(sparqlRequest.sparqlRequest).not.toHaveBeenCalled()
    })
  })

  describe('When called without a version', () => {
    test('should use "draft" as the default version', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: {}
      }

      vi.spyOn(getSchemeInfo, 'getSchemeInfo').mockReturnValue({
        schemeId: 'testScheme',
        schemePrefLabel: 'New Label'
      })

      vi.spyOn(getConceptSchemeDetails, 'getConceptSchemeDetails').mockResolvedValue({
        prefLabel: 'Old Label'
      })

      vi.spyOn(sparqlRequest, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpers, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpers, 'commitTransaction').mockResolvedValue()

      await updateConceptScheme(mockEvent)

      expect(getConceptSchemeDetails.getConceptSchemeDetails).toHaveBeenCalledWith({
        schemeName: 'testScheme',
        version: 'draft'
      })
    })
  })
})
