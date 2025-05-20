import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { conceptIdExists } from '@/shared/conceptIdExists'
import { deleteTriples } from '@/shared/deleteTriples'
import { ensureReciprocalRelations } from '@/shared/ensureReciprocalRelations'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateModifiedDate } from '@/shared/updateModifiedDate'
import { updateConcept } from '@/updateConcept/handler'

vi.mock('@/shared/transactionHelpers')
vi.mock('@/shared/conceptIdExists')
vi.mock('@/shared/deleteTriples')
vi.mock('@/shared/ensureReciprocalRelations')
vi.mock('@/shared/rollback')
vi.mock('@/shared/getConceptId')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/updateModifiedDate')

describe('updateConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockRdfXml = '<rdf:RDF><skos:Concept><skos:inScheme rdf:resource=\"https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords\"/></skos:Concept></rdf:RDF>'
  const mockEvent = {
    body: mockRdfXml,
    queryStringParameters: {
      scheme: 'sciencekeywords',
      version: 'draft'
    }
  }
  const mockConceptId = '123'
  const mockDeletedTriples = [{
    s: { value: 'subject' },
    p: { value: 'predicate' },
    o: { value: 'object' }
  }]

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    getConceptId.mockReturnValue(mockConceptId)
    deleteTriples.mockResolvedValue({
      deletedTriples: mockDeletedTriples,
      deleteResponse: { ok: true }
    })

    startTransaction.mockResolvedValue('mock-transaction-url')
    ensureReciprocalRelations.mockResolvedValue({ ok: true })
  })

  describe('when succesful', () => {
    test('should update concept and return 200 if concept exists and update succeeds', async () => {
      conceptIdExists.mockResolvedValue(true)
      startTransaction.mockResolvedValue('mock-transaction-url')
      deleteTriples.mockResolvedValue({ ok: true })
      sparqlRequest.mockResolvedValue({ ok: true })
      updateModifiedDate.mockResolvedValue(true)
      commitTransaction.mockResolvedValue()

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(expect.stringContaining('<skos:inScheme'))
      expect(conceptIdExists).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(startTransaction).toHaveBeenCalled()
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft', 'mock-transaction-url')
      expect(sparqlRequest).toHaveBeenCalledWith({
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        method: 'PUT',
        body: expect.stringContaining('<skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords"/>'),
        version: 'draft',
        transaction: {
          transactionUrl: 'mock-transaction-url',
          action: 'ADD'
        }
      })

      expect(ensureReciprocalRelations).toHaveBeenCalledWith({
        rdfXml: expect.stringContaining('<skos:inScheme'),
        conceptId: '123',
        version: 'draft',
        transactionUrl: 'mock-transaction-url'
      })

      expect(updateModifiedDate).toHaveBeenCalledWith('123', 'draft', expect.any(String), 'mock-transaction-url')
      expect(commitTransaction).toHaveBeenCalledWith('mock-transaction-url')

      expect(rollbackTransaction).not.toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully updated concept: 123' }),
        headers: mockDefaultHeaders
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should rollback transaction and return 500 if delete succeeds but insert fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({ ok: true })
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await updateConcept(mockEvent)

      expect(startTransaction).toHaveBeenCalled()
      expect(deleteTriples).toHaveBeenCalled()
      expect(sparqlRequest).toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith('mock-transaction-url')
      expect(commitTransaction).not.toHaveBeenCalled()

      expect(result.statusCode).toBe(500)
    })

    test('should return 500 if scheme is missing', async () => {
      const eventWithoutScheme = {
        body: mockRdfXml,
        queryStringParameters: { version: 'draft' }
      }

      const result = await updateConcept(eventWithoutScheme)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Missing scheme parameter')
    })

    test('should handle missing body in event', async () => {
      const eventWithoutBody = { queryStringParameters: { scheme: 'sciencekeywords' } }

      const result = await updateConcept(eventWithoutBody)

      expect(getConceptId).not.toHaveBeenCalled()
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Missing RDF/XML data in request body'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle error when rolling back transaction fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({ ok: true })
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      rollbackTransaction.mockRejectedValue(new Error('Rollback failed'))

      const consoleErrorSpy = vi.spyOn(console, 'error')

      const result = await updateConcept(mockEvent)

      expect(startTransaction).toHaveBeenCalled()
      expect(deleteTriples).toHaveBeenCalled()
      expect(sparqlRequest).toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith('mock-transaction-url')
      expect(commitTransaction).not.toHaveBeenCalled()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('HTTP error! insert new data status: 500')

      // Check that both error messages were logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error inserting new data, rolling back:', expect.any(Error))
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    test('should return 500 if starting transaction fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      startTransaction.mockRejectedValue(new Error('Failed to start transaction'))

      const result = await updateConcept(mockEvent)

      expect(startTransaction).toHaveBeenCalled()
      expect(deleteTriples).not.toHaveBeenCalled()
      expect(sparqlRequest).not.toHaveBeenCalled()
      expect(rollbackTransaction).not.toHaveBeenCalled()
      expect(commitTransaction).not.toHaveBeenCalled()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to start transaction')
    })

    test('should return 404 if concept does not exist', async () => {
      conceptIdExists.mockResolvedValue(false)

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith('<rdf:RDF><skos:Concept><skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords"/></skos:Concept></rdf:RDF>')
      expect(result).toEqual({
        statusCode: 404,
        body: JSON.stringify({ message: 'Concept https://gcmd.earthdata.nasa.gov/kms/concept/123 not found' }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle missing body in event', async () => {
      const eventWithoutBody = {}

      const result = await updateConcept(eventWithoutBody)

      expect(getConceptId).not.toHaveBeenCalled()
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Missing RDF/XML data in request body'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle missing concept id in rdf/xml', async () => {
      getConceptId.mockReturnValue(null)

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Invalid or missing concept ID'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle invalid rdf/xml when getting concept id', async () => {
      getConceptId.mockImplementation(() => {
        throw new Error('Invalid XML')
      })

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Invalid XML'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle database error', async () => {
      conceptIdExists.mockRejectedValue(new Error('Database error'))

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(conceptIdExists).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Database error'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should return 500 when delete operation fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft', 'mock-transaction-url')
      expect(sparqlRequest).not.toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Failed to delete existing triples'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle error when sparql request fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft', 'mock-transaction-url')
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Failed to delete existing triples'
        }),
        headers: mockDefaultHeaders
      })
    })
  })

  describe('when updating last modified date', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-05-15T10:30:00.000Z'))

      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({ ok: true })
      sparqlRequest.mockResolvedValue({ ok: true })

      // Add these lines to mock console methods
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks() // This will restore all mocked functions
    })

    test('should update modified date after successful concept update', async () => {
      updateModifiedDate.mockResolvedValue(true)

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', '2023-05-15T10:30:00.000Z', 'mock-transaction-url')
      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe(`Successfully updated concept: ${mockConceptId}`)
    })

    test('should use provided version for updating modified date', async () => {
      const versionedEvent = {
        ...mockEvent,
        queryStringParameters: { version: 'published' }
      }
      updateModifiedDate.mockResolvedValue(true)

      await updateConcept(versionedEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'published', '2023-05-15T10:30:00.000Z', 'mock-transaction-url')
    })

    test('should handle errors from updateModifiedDate', async () => {
      updateModifiedDate.mockRejectedValue(new Error('Failed to update modified date'))

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', '2023-05-15T10:30:00.000Z', 'mock-transaction-url')
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Error updating concept',
        error: 'Failed to update modified date'
      })

      expect(console.error).toHaveBeenCalledWith(
        'Error inserting new data, rolling back:',
        expect.objectContaining({ message: 'Failed to update modified date' })
      )
    })

    test('should not update modified date if concept update fails', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).not.toHaveBeenCalled()
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('HTTP error! insert status: 500')
    })

    test('should throw an error if updating modified date fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({ ok: true })
      sparqlRequest.mockResolvedValue({ ok: true })
      updateModifiedDate.mockResolvedValue(false)

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', expect.any(String), 'mock-transaction-url')
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Error updating concept',
        error: 'HTTP error! updating last modified date failed'
      })

      expect(rollbackTransaction).toHaveBeenCalledWith('mock-transaction-url')
      expect(commitTransaction).not.toHaveBeenCalled()
    })

    test('should use current date for updating modified date', async () => {
      const customDate = new Date('2024-01-01T00:00:00.000Z')
      vi.setSystemTime(customDate)
      updateModifiedDate.mockResolvedValue(true)

      await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', customDate.toISOString(), 'mock-transaction-url')
    })
  })
})
