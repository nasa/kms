import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import * as getConceptSchemeDetailsModule from '@/shared/getConceptSchemeDetails'
import * as getConfigModule from '@/shared/getConfig'
import * as getSchemeInfoModule from '@/shared/getSchemeInfo'
import * as sparqlRequestModule from '@/shared/sparqlRequest'
import * as transactionHelpersModule from '@/shared/transactionHelpers'
import * as validateSchemeNotationModule from '@/shared/validateSchemeNotation'

import { createConceptScheme } from '../handler'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/getSchemeInfo')
vi.mock('@/shared/getConceptSchemeDetails')
vi.mock('@/shared/transactionHelpers')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/validateSchemeNotation')

describe('createConceptScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getConfigModule.getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'Content-Type': 'application/json' }
    })
  })

  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('When validating scheme notation', () => {
    test('should proceed if validation is successful', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      validateSchemeNotationModule.validateSchemeNotation.mockReturnValue(true)
      getSchemeInfoModule.getSchemeInfo.mockReturnValue({
        schemeId: 'test-scheme',
        schemePrefLabel: 'Test Scheme'
      })

      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue(null)
      transactionHelpersModule.startTransaction.mockResolvedValue('http://transaction-url')
      sparqlRequestModule.sparqlRequest.mockResolvedValue({ ok: true })

      const result = await createConceptScheme(mockEvent)

      expect(validateSchemeNotationModule.validateSchemeNotation)
        .toHaveBeenCalledWith(mockEvent.body)

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Successfully created scheme',
        schemeId: 'test-scheme'
      })
    })

    test('should return a 400 error if validation fails', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      validateSchemeNotationModule.validateSchemeNotation.mockImplementation(() => {
        throw new Error('Validation failed')
      })

      const result = await createConceptScheme(mockEvent)

      expect(validateSchemeNotationModule.validateSchemeNotation)
        .toHaveBeenCalledWith(mockEvent.body)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Error creating scheme',
        error: 'Validation failed'
      })
    })
  })

  describe('When called with valid input', () => {
    test('should create a new concept scheme successfully', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({
        schemeId: 'test-scheme',
        schemePrefLabel: 'Test Scheme'
      })

      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue(null)
      transactionHelpersModule.startTransaction.mockResolvedValue('http://transaction-url')
      sparqlRequestModule.sparqlRequest.mockResolvedValue({ ok: true })

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

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Missing RDF/XML data in request body')
    })
  })

  describe('When called with invalid scheme ID', () => {
    test('should return a 400 error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({ schemeId: null })

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Invalid or missing scheme ID')
    })
  })

  describe('When the scheme already exists', () => {
    test('should return a 409 conflict error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({ schemeId: 'existing-scheme' })
      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue({ id: 'existing-scheme' })

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

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({
        schemeId: 'test-scheme',
        schemePrefLabel: 'Test Scheme'
      })

      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue(null)
      transactionHelpersModule.startTransaction.mockResolvedValue('http://transaction-url')

      // Mock the sparqlRequest to return a response object with a text method
      sparqlRequestModule.sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      })

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('HTTP error! status: 500')
      expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('http://transaction-url')
    })
  })

  describe('When there is an error creating the root concept', () => {
    test('should rollback the transaction and return a 400 error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({
        schemeId: 'test-scheme',
        schemePrefLabel: 'Test Scheme'
      })

      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue(null)
      transactionHelpersModule.startTransaction.mockResolvedValue('http://transaction-url')

      // Mock successful response for the first SPARQL request (creating the scheme)
      sparqlRequestModule.sparqlRequest.mockResolvedValueOnce({
        ok: true
      })

      // Mock error response for the second SPARQL request (creating the root concept)
      sparqlRequestModule.sparqlRequest.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      })

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('HTTP error! status: 500')
      expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('http://transaction-url')
    })
  })

  describe('When the transaction commit fails', () => {
    test('should return a 400 error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({
        schemeId: 'test-scheme',
        schemePrefLabel: 'Test Scheme'
      })

      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue(null)
      transactionHelpersModule.startTransaction.mockResolvedValue('http://transaction-url')
      sparqlRequestModule.sparqlRequest.mockResolvedValue({ ok: true })
      transactionHelpersModule.commitTransaction.mockRejectedValue(new Error('Commit failed'))

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('Commit failed')
      expect(transactionHelpersModule.rollbackTransaction).toHaveBeenCalledWith('http://transaction-url')
    })
  })

  describe('When the transaction rollback fails', () => {
    test('should log the rollback error and return the original error', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: { version: 'draft' }
      }

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({
        schemeId: 'test-scheme',
        schemePrefLabel: 'Test Scheme'
      })

      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue(null)
      transactionHelpersModule.startTransaction.mockResolvedValue('http://transaction-url')
      sparqlRequestModule.sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))
      transactionHelpersModule.rollbackTransaction.mockRejectedValue(new Error('Rollback failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await createConceptScheme(mockEvent)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).error).toBe('SPARQL request failed')
      expect(consoleSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('When no version is provided in queryStringParameters', () => {
    test('should use "draft" as the default version', async () => {
      const mockEvent = {
        body: '<rdf:RDF>...</rdf:RDF>',
        queryStringParameters: {}
      }

      getSchemeInfoModule.getSchemeInfo.mockReturnValue({
        schemeId: 'test-scheme',
        schemePrefLabel: 'Test Scheme'
      })

      getConceptSchemeDetailsModule.getConceptSchemeDetails.mockResolvedValue(null)
      transactionHelpersModule.startTransaction.mockResolvedValue('http://transaction-url')
      sparqlRequestModule.sparqlRequest.mockResolvedValue({ ok: true })

      await createConceptScheme(mockEvent)

      expect(getConceptSchemeDetailsModule.getConceptSchemeDetails).toHaveBeenCalledWith({
        schemeName: 'test-scheme',
        version: 'draft'
      })
    })
  })
})
