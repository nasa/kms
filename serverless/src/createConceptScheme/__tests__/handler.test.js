import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import * as addCreatedDateToConceptSchemeModule from '@/shared/addCreatedDateToConceptScheme'
import * as getConceptSchemeDetailsModule from '@/shared/getConceptSchemeDetails'
import * as getConfigModule from '@/shared/getConfig'
import * as getSchemeIdModule from '@/shared/getSchemeId'
import * as sparqlRequestModule from '@/shared/sparqlRequest'
import * as transactionHelpersModule from '@/shared/transactionHelpers'

import { createConceptScheme } from '../handler'

let consoleLogSpy
let consoleErrorSpy

describe('createConceptScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mock('@/shared/getConfig')
    vi.mock('@/shared/getSchemeId')
    vi.mock('@/shared/getConceptSchemeDetails')
    vi.mock('@/shared/addCreatedDateToConceptScheme')
    vi.mock('@/shared/sparqlRequest')
    vi.mock('@/shared/transactionHelpers')

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()

    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('When called with valid input', () => {
    test('should create a new concept scheme successfully', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue('test-scheme')
      vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue(null)
      vi.spyOn(addCreatedDateToConceptSchemeModule, 'addCreatedDateToConceptScheme').mockReturnValue('<rdf:RDF>...processed...</rdf:RDF>')
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpersModule, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpersModule, 'commitTransaction').mockResolvedValue()

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Successfully created scheme',
        schemeId: 'test-scheme'
      })
    })
  })

  describe('When called with missing RDF/XML data', () => {
    test('should return a 400 error', async () => {
      const mockEvent = { queryStringParameters: { version: 'draft' } }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Missing RDF/XML data in request body')
    })
  })

  describe('When the scheme already exists', () => {
    test('should return a 409 conflict error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue('existing-scheme')
      vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue({ id: 'existing-scheme' })

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(409)
      expect(JSON.parse(result.body).message).toBe('Scheme existing-scheme already exists.')
    })
  })

  describe('When there is an error during SPARQL request', () => {
    test('should rollback the transaction and return a 400 error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue('test-scheme')
      vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue(null)
      vi.spyOn(addCreatedDateToConceptSchemeModule, 'addCreatedDateToConceptScheme').mockReturnValue('<rdf:RDF>...processed...</rdf:RDF>')
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server Error'
      })

      vi.spyOn(transactionHelpersModule, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpersModule, 'rollbackTransaction').mockResolvedValue()

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('HTTP error! status: 500')
      expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    })
  })

  describe('When there is an error rolling back the transaction', () => {
    test('should log the rollback error and return a 400 error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue('test-scheme')
      vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue(null)
      vi.spyOn(addCreatedDateToConceptSchemeModule, 'addCreatedDateToConceptScheme').mockReturnValue('<rdf:RDF>...processed...</rdf:RDF>')
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockRejectedValue(new Error('SPARQL Error'))
      vi.spyOn(transactionHelpersModule, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpersModule, 'rollbackTransaction').mockRejectedValue(new Error('Rollback Error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('SPARQL Error')
      expect(consoleSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))
      expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('transaction-url')
    })
  })

  describe('When the scheme ID is missing or invalid', () => {
    test('should return a 400 error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue(null)

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Invalid or missing scheme ID')
    })
  })

  describe('When no version is provided in query parameters', () => {
    test('should use "draft" as the default version', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: {}
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue('test-scheme')
      vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue(null)
      vi.spyOn(addCreatedDateToConceptSchemeModule, 'addCreatedDateToConceptScheme').mockReturnValue('<rdf:RDF>...processed...</rdf:RDF>')
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpersModule, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpersModule, 'commitTransaction').mockResolvedValue()

      await createConceptScheme(mockEvent)

      expect(getConceptSchemeDetailsModule.getConceptSchemeDetails).toHaveBeenCalledWith({
        schemeName: 'test-scheme',
        version: 'draft'
      })

      expect(sparqlRequestModule.sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        version: 'draft'
      }))
    })
  })

  describe('When addCreatedDateToConceptScheme is called', () => {
    test('should process the RDF/XML with added creation date', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue('test-scheme')
      vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue(null)
      vi.spyOn(addCreatedDateToConceptSchemeModule, 'addCreatedDateToConceptScheme').mockReturnValue('<rdf:RDF>...processed with date...</rdf:RDF>')
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpersModule, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpersModule, 'commitTransaction').mockResolvedValue()

      await createConceptScheme(mockEvent)

      expect(addCreatedDateToConceptSchemeModule.addCreatedDateToConceptScheme).toHaveBeenCalledWith('<rdf:RDF>...</rdf:RDF>')
      expect(sparqlRequestModule.sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: '<rdf:RDF>...processed with date...</rdf:RDF>'
        })
      )
    })
  })

  describe('When the SPARQL request is successful', () => {
    test('should commit the transaction', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      vi.spyOn(getConfigModule, 'getApplicationConfig').mockReturnValue({
        defaultResponseHeaders: { 'Content-Type': 'application/json' }
      })

      vi.spyOn(getSchemeIdModule, 'getSchemeId').mockReturnValue('test-scheme')
      vi.spyOn(getConceptSchemeDetailsModule, 'getConceptSchemeDetails').mockResolvedValue(null)
      vi.spyOn(addCreatedDateToConceptSchemeModule, 'addCreatedDateToConceptScheme').mockReturnValue('<rdf:RDF>...processed...</rdf:RDF>')
      vi.spyOn(sparqlRequestModule, 'sparqlRequest').mockResolvedValue({ ok: true })
      vi.spyOn(transactionHelpersModule, 'startTransaction').mockResolvedValue('transaction-url')
      vi.spyOn(transactionHelpersModule, 'commitTransaction').mockResolvedValue()

      await createConceptScheme(mockEvent)

      expect(transactionHelpersModule.commitTransaction).toHaveBeenCalledWith('transaction-url')
    })
  })
})
