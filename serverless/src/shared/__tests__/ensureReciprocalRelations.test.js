import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getResourceValues } from '@/shared/getResourceValues'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { ensureReciprocalRelations } from '../ensureReciprocalRelations'

vi.mock('@/shared/getResourceValues')
vi.mock('@/shared/sparqlRequest')

describe('ensureReciprocalRelations', () => {
  const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
  const mockConceptId = '123-456-789'
  const mockVersion = '1'
  const mockTransactionUrl = 'http://example.com/transaction'

  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.resetAllMocks()
  })

  describe('When called with valid parameters', () => {
    test('should create reciprocal relationships for existing relation types', async () => {
      getResourceValues.mockImplementation((_, type) => {
        if (type === 'skos:broader') return ['http://example.com/concept/abc-def-ghi']

        return []
      })

      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(result).toEqual({ ok: true })
      expect(getResourceValues).toHaveBeenCalledWith(mockRdfXml, 'skos:broader')
      expect(sparqlRequest).toHaveBeenCalled()
    })

    test('should handle multiple relation types', async () => {
      getResourceValues.mockImplementation((_, type) => {
        if (type === 'skos:broader') return ['http://example.com/concept/abc-def-ghi']
        if (type === 'skos:related') return ['http://example.com/concept/jkl-mno-pqr']

        return []
      })

      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(getResourceValues).toHaveBeenCalledWith(mockRdfXml, 'skos:broader')
      expect(getResourceValues).toHaveBeenCalledWith(mockRdfXml, 'skos:related')
      expect(sparqlRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('When an error occurs', () => {
    test('should throw an error if sparqlRequest fails', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept/abc-def-ghi'])
      sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

      await expect(ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })).rejects.toThrow('SPARQL request failed')
    })
  })

  describe('When no relations exist', () => {
    test('should not make any SPARQL requests', async () => {
      getResourceValues.mockReturnValue([])

      const result = await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(result).toEqual({ ok: true })
      expect(sparqlRequest).not.toHaveBeenCalled()
    })
  })

  describe('When processing multiple relation types', () => {
    test('should create reciprocal relationships for all existing types', async () => {
      getResourceValues.mockImplementation((_, type) => {
        switch (type) {
          case 'skos:broader':
            return ['http://example.com/concept/abc-def-ghi']
          case 'gcmd:hasInstrument':
            return ['http://example.com/concept/jkl-mno-pqr']
          default:
            return []
        }
      })

      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(result).toEqual({ ok: true })
      expect(getResourceValues).toHaveBeenCalledWith(mockRdfXml, 'skos:broader')
      expect(getResourceValues).toHaveBeenCalledWith(mockRdfXml, 'gcmd:hasInstrument')
      expect(sparqlRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('When processing reciprocal relationships', () => {
    test('should create the correct reciprocal relationship', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept/abc-def-ghi'])
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('skos:narrower'),
          version: mockVersion,
          transaction: {
            transactionUrl: mockTransactionUrl,
            action: 'UPDATE'
          }
        })
      )
    })
  })

  describe('When processing self-reciprocal relationships', () => {
    test('should create the same relationship type for skos:related', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept/abc-def-ghi'])
      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('skos:related'),
          version: mockVersion,
          transaction: {
            transactionUrl: mockTransactionUrl,
            action: 'UPDATE'
          }
        })
      )
    })
  })

  describe('When processing multiple related concepts', () => {
    test('should create reciprocal relationships for all related concepts', async () => {
      getResourceValues.mockReturnValue([
        'http://example.com/concept/abc-def-ghi',
        'http://example.com/concept/jkl-mno-pqr'
      ])

      sparqlRequest.mockResolvedValue({ ok: true })

      await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('abc-def-ghi')
        })
      )

      expect(sparqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('jkl-mno-pqr')
        })
      )
    })
  })

  describe('When handling SPARQL request errors', () => {
    test('should throw an error with a specific message', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept/abc-def-ghi'])
      sparqlRequest.mockResolvedValue({ ok: false })

      await expect(ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })).rejects.toThrow('Failed to create reciprocal skos:narrower relationships')
    })
  })

  describe('When logging errors', () => {
    test('should log errors to the console', async () => {
      getResourceValues.mockReturnValue(['http://example.com/concept/abc-def-ghi'])
      sparqlRequest.mockRejectedValue(new Error('SPARQL request failed'))

      await expect(ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })).rejects.toThrow('SPARQL request failed')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error creating reciprocal relationships:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('When handling empty response from getResourceValues', () => {
    test('should not create any reciprocal relationships', async () => {
      getResourceValues.mockReturnValue([])

      const result = await ensureReciprocalRelations({
        rdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: mockVersion,
        transactionUrl: mockTransactionUrl
      })

      expect(result).toEqual({ ok: true })
      expect(sparqlRequest).not.toHaveBeenCalled()
    })
  })
})
