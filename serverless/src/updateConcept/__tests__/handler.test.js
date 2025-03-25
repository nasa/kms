import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { conceptIdExists } from '@/shared/conceptIdExists'
import { deleteTriples } from '@/shared/deleteTriples'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { rollback } from '@/shared/rollback'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { updateModifiedDate } from '@/shared/updateModifiedDate'
import { updateConcept } from '@/updateConcept/handler'

// Mock the dependencies
vi.mock('@/shared/conceptIdExists')
vi.mock('@/shared/deleteTriples')
vi.mock('@/shared/rollback')
vi.mock('@/shared/getConceptId')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/updateModifiedDate')

describe('updateConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
  const mockEvent = { body: mockRdfXml }
  const mockConceptId = '123'
  const mockDeletedTriples = [{
    s: { value: 'subject' },
    p: { value: 'predicate' },
    o: { value: 'object' }
  }]

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    getConceptId.mockReturnValue(mockConceptId)
    deleteTriples.mockResolvedValue({
      deletedTriples: mockDeletedTriples,
      deleteResponse: { ok: true }
    })

    rollback.mockResolvedValue()
  })

  describe('when succesful', () => {
    test('should update concept and return 200 if concept exists and update succeeds', async () => {
      conceptIdExists.mockResolvedValue(true)
      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(sparqlRequest).toHaveBeenCalledWith({
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        path: '/statements',
        method: 'POST',
        body: mockRdfXml,
        version: 'draft'
      })

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully updated concept: 123' }),
        headers: mockDefaultHeaders
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should return 404 if concept does not exist', async () => {
      conceptIdExists.mockResolvedValue(false)

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
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

    test('should handle getConceptId returning null', async () => {
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

    test('should handle getConceptId throwing an error', async () => {
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

    test('should handle conceptIdExists throwing an error', async () => {
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

    test('should return 500 if delete operation fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      deleteTriples.mockResolvedValue({
        deletedTriples: mockDeletedTriples,
        deleteResponse: {
          ok: false,
          status: 500
        }
      })

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(sparqlRequest).not.toHaveBeenCalled()
      expect(rollback).not.toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'HTTP error! delete status: 500'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle sparqlRequest throwing an error', async () => {
      conceptIdExists.mockResolvedValue(true)
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(sparqlRequest).toHaveBeenCalled()
      expect(rollback).toHaveBeenCalledWith(mockDeletedTriples, 'draft')
      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Network error'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should rollback and return 500 if delete succeeds but insert fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(sparqlRequest).toHaveBeenCalledWith({
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        path: '/statements',
        method: 'POST',
        body: mockRdfXml,
        version: 'draft'
      })

      expect(rollback).toHaveBeenCalledWith(mockDeletedTriples, 'draft')

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'HTTP error! insert status: 500'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should return 500 if rollback fails', async () => {
      conceptIdExists.mockResolvedValue(true)
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      rollback.mockRejectedValue(new Error('Rollback failed'))

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft')
      expect(sparqlRequest).toHaveBeenCalled()
      expect(rollback).toHaveBeenCalledWith(mockDeletedTriples, 'draft')

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Rollback failed'
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
      deleteTriples.mockResolvedValue({
        deletedTriples: mockDeletedTriples,
        deleteResponse: { ok: true }
      })

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

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', '2023-05-15T10:30:00.000Z')
      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe(`Successfully updated concept: ${mockConceptId}`)
      expect(console.log).toHaveBeenCalledWith(`Updated modified date to 2023-05-15T10:30:00.000Z for concept ${mockConceptId}`)
    })

    test('should log warning if updating modified date fails', async () => {
      updateModifiedDate.mockResolvedValue(false)

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', '2023-05-15T10:30:00.000Z')
      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe(`Successfully updated concept: ${mockConceptId}`)
      expect(console.warn).toHaveBeenCalledWith(`Failed to update modified date for concept ${mockConceptId}`)
    })

    test('should still return success if concept update succeeds but modified date update fails', async () => {
      updateModifiedDate.mockResolvedValue(false)

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', '2023-05-15T10:30:00.000Z')
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

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'published', '2023-05-15T10:30:00.000Z')
    })

    test('should handle errors from updateModifiedDate', async () => {
      updateModifiedDate.mockRejectedValue(new Error('Failed to update modified date'))

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', '2023-05-15T10:30:00.000Z')
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Error updating concept',
        error: 'Failed to update modified date'
      })

      expect(console.error).toHaveBeenCalledWith(
        'Error inserting new data, rolling back:',
        expect.objectContaining({ message: 'Failed to update modified date' })
      )

      expect(rollback).toHaveBeenCalledWith(mockDeletedTriples, 'draft')
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

    test('should use current date for updating modified date', async () => {
      const customDate = new Date('2024-01-01T00:00:00.000Z')
      vi.setSystemTime(customDate)
      updateModifiedDate.mockResolvedValue(true)

      await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', customDate.toISOString())
    })
  })
})
