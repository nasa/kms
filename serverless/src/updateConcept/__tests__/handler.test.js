import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

// Import mocked functions
import { captureRelations } from '@/shared/captureRelations'
import { deleteTriples } from '@/shared/deleteTriples'
import { ensureReciprocal } from '@/shared/ensureReciprocal'
import { getConceptById } from '@/shared/getConceptById'
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

// Mock all imported functions
vi.mock('@/shared/deleteTriples')
vi.mock('@/shared/ensureReciprocal')
vi.mock('@/shared/getConceptById')
vi.mock('@/shared/getConceptId')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/transactionHelpers')
vi.mock('@/shared/updateModifiedDate')
vi.mock('@/shared/captureRelations')

describe('updateConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
  const mockEvent = {
    body: mockRdfXml,
    queryStringParameters: { version: 'draft' }
  }
  const mockConceptId = '123'
  const mockOldRdfXml = '<rdf:RDF>old content</rdf:RDF>'
  const mockTransactionUrl = 'mock-transaction-url'

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    getConceptId.mockReturnValue(mockConceptId)
    getConceptById.mockResolvedValue(mockOldRdfXml)
    startTransaction.mockResolvedValue(mockTransactionUrl)
    deleteTriples.mockResolvedValue({ ok: true })
    sparqlRequest.mockResolvedValue({ ok: true })
    ensureReciprocal.mockResolvedValue({ ok: true })
    updateModifiedDate.mockResolvedValue(true)
    commitTransaction.mockResolvedValue()
    captureRelations.mockResolvedValue([
      {
        from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept A',
        toPrefLabel: 'Concept B'
      },
      {
        from: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
        relation: 'narrower',
        to: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
        fromPrefLabel: 'Concept C',
        toPrefLabel: 'Concept A'
      }
    ])

    sparqlRequest.mockImplementation((params) => {
      if (params.body.includes('skos:changeNote')) {
        return Promise.resolve({
          ok: true,
          status: 200
        })
      }

      return Promise.resolve({ ok: true })
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should update concept and return 200 if concept exists and update succeeds', async () => {
      sparqlRequest.mockResolvedValue({ ok: true })
      updateModifiedDate.mockResolvedValue(true)
      commitTransaction.mockResolvedValue()

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(getConceptById).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(startTransaction).toHaveBeenCalled()
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft', 'mock-transaction-url')
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'PUT',
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        body: mockRdfXml,
        version: 'draft',
        transaction: {
          transactionUrl: 'mock-transaction-url',
          action: 'ADD'
        }
      })

      expect(ensureReciprocal).toHaveBeenCalledWith({
        oldRdfXml: mockOldRdfXml,
        newRdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: 'draft',
        transactionUrl: 'mock-transaction-url'
      })

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', expect.any(String), 'mock-transaction-url')
      expect(commitTransaction).toHaveBeenCalledWith('mock-transaction-url')

      expect(rollbackTransaction).not.toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({ message: 'Successfully updated concept: 123' }),
        headers: mockDefaultHeaders
      })
    })
  })

  describe('when handling reciprocal relationships', () => {
    test('should ensure reciprocal relationships are handled', async () => {
      await updateConcept(mockEvent)

      expect(ensureReciprocal).toHaveBeenCalledWith({
        oldRdfXml: mockOldRdfXml,
        newRdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: 'draft',
        transactionUrl: 'mock-transaction-url'
      })
    })

    test('should rollback transaction if ensuring reciprocal relations fails', async () => {
      ensureReciprocal.mockRejectedValue(new Error('Failed to ensure reciprocal relations'))

      const result = await updateConcept(mockEvent)

      expect(ensureReciprocal).toHaveBeenCalled()
      expect(rollbackTransaction).toHaveBeenCalledWith('mock-transaction-url')
      expect(commitTransaction).not.toHaveBeenCalled()
      expect(updateModifiedDate).not.toHaveBeenCalled()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to ensure reciprocal relations')
    })

    test('should handle reciprocal relationships for new concepts', async () => {
      getConceptById.mockResolvedValue(null)

      await updateConcept(mockEvent)

      expect(ensureReciprocal).toHaveBeenCalledWith(expect.objectContaining({
        oldRdfXml: null,
        newRdfXml: mockRdfXml
      }))
    })

    test('should use correct version for reciprocal relationships', async () => {
      const customVersion = 'published'
      const eventWithCustomVersion = {
        ...mockEvent,
        queryStringParameters: { version: customVersion }
      }

      await updateConcept(eventWithCustomVersion)

      expect(ensureReciprocal).toHaveBeenCalledWith(expect.objectContaining({
        version: customVersion
      }))
    })
  })

  describe('when updating last modified date', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-05-15T10:30:00.000Z'))

      deleteTriples.mockResolvedValue({ ok: true })
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('should update modified date after successful concept update', async () => {
      updateModifiedDate.mockResolvedValue(true)

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', '2023-05-15T10:30:00.000Z', 'mock-transaction-url')
      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toBe(`Successfully updated concept: ${mockConceptId}`)
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
    })

    test('should not update modified date if concept update fails', async () => {
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await updateConcept(mockEvent)

      expect(updateModifiedDate).not.toHaveBeenCalled()
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('HTTP error! insert/update data status: 500')
    })

    test('should throw an error if updating modified date fails', async () => {
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

  describe('when handling different versions', () => {
    test('should use provided version when updating concept', async () => {
      const customVersion = 'published'
      const eventWithCustomVersion = {
        ...mockEvent,
        queryStringParameters: { version: customVersion }
      }
      ensureReciprocal.mockResolvedValue({ ok: true })

      await updateConcept(eventWithCustomVersion)

      expect(getConceptById).toHaveBeenCalledWith(mockConceptId, customVersion)
      expect(deleteTriples).toHaveBeenCalledWith(`https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`, customVersion, 'mock-transaction-url')
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({ version: customVersion }))
      expect(ensureReciprocal).toHaveBeenCalledWith(expect.objectContaining({
        oldRdfXml: mockOldRdfXml,
        newRdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: customVersion,
        transactionUrl: 'mock-transaction-url'
      }))

      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, customVersion, expect.any(String), 'mock-transaction-url')
    })

    test('should use default version (draft) when no version is provided', async () => {
      const eventWithoutVersion = {
        ...mockEvent,
        queryStringParameters: {}
      }

      await updateConcept(eventWithoutVersion)

      expect(getConceptById).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(deleteTriples).toHaveBeenCalledWith(`https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`, 'draft', 'mock-transaction-url')
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({ version: 'draft' }))
      expect(ensureReciprocal).toHaveBeenCalledWith(expect.objectContaining({ version: 'draft' }))
      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', expect.any(String), 'mock-transaction-url')
    })
  })

  describe('when handling non-existent concepts', () => {
    test('should create a new concept if it does not exist', async () => {
      getConceptById.mockResolvedValue(null)

      await updateConcept(mockEvent)

      expect(deleteTriples).not.toHaveBeenCalled()
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        method: 'PUT',
        body: mockRdfXml
      }))

      expect(ensureReciprocal).toHaveBeenCalledWith(expect.objectContaining({
        oldRdfXml: null,
        newRdfXml: mockRdfXml
      }))
    })
  })

  describe('when unsuccessful', () => {
    test('should rollback transaction and return 500 if delete succeeds but insert fails', async () => {
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
      expect(JSON.parse(result.body).error).toBe('HTTP error! insert/update data status: 500')
    })

    test('should handle missing body in event', async () => {
      const eventWithoutBody = { queryStringParameters: { version: 'draft' } }

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
      expect(JSON.parse(result.body).error).toBe('HTTP error! insert/update data status: 500')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating concept:', expect.any(Error))
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })

    test('should return 500 if starting transaction fails', async () => {
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

    test('should return 500 when delete operation fails', async () => {
      deleteTriples.mockResolvedValue({
        ok: false
      })

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123', 'draft', 'mock-transaction-url')
      expect(sparqlRequest).not.toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Failed to delete existing concept'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle error when getConceptById fails', async () => {
      getConceptById.mockRejectedValue(new Error('Failed to retrieve concept'))

      const result = await updateConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(getConceptById).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(startTransaction).not.toHaveBeenCalled()

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error updating concept',
          error: 'Failed to retrieve concept'
        }),
        headers: mockDefaultHeaders
      })
    })
  })

  describe('edge cases', () => {
    test('should handle empty RDF/XML', async () => {
      const eventWithEmptyRdfXml = {
        ...mockEvent,
        body: ''
      }

      const result = await updateConcept(eventWithEmptyRdfXml)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Missing RDF/XML data in request body')
    })

    test('should handle malformed RDF/XML', async () => {
      const eventWithMalformedRdfXml = {
        ...mockEvent,
        body: '<rdf:RDF>malformed xml'
      }

      getConceptId.mockImplementation(() => {
        throw new Error('Malformed XML')
      })

      const result = await updateConcept(eventWithMalformedRdfXml)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Malformed XML')
    })

    test('should handle very large RDF/XML', async () => {
      const largeRdfXml = `<rdf:RDF>${'a'.repeat(1000000)}</rdf:RDF>` // 1MB of data
      const eventWithLargeRdfXml = {
        ...mockEvent,
        body: largeRdfXml
      }

      await updateConcept(eventWithLargeRdfXml)

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: largeRdfXml
      }))
    })
  })

  describe('when capturing relations', () => {
    test('should capture changes and log them as skos:changeNotes when changes occur', async () => {
      const oldRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]
      const newRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept C'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(oldRelations)
        .mockResolvedValueOnce(newRelations)

      await updateConcept(mockEvent)

      // Check if captureRelations was called twice (before and after update)
      expect(captureRelations).toHaveBeenCalledTimes(2)

      // Check if sparqlRequest was called to add skos:changeNote
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('skos:changeNote')
      }))

      // Check if the change note includes the correct information
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Removed broader relation from Concept A [123] to Concept B [456]')
      }))

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Added broader relation from Concept A [123] to Concept C [789]')
      }))

      // Verify that the change notes are added to the correct concept
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining(`<https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}>`)
      }))
    })

    test('should handle missing prefLabels when capturing relations', async () => {
      const oldRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
          // Missing fromPrefLabel and toPrefLabel
        }
      ]
      const newRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept C'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(oldRelations)
        .mockResolvedValueOnce(newRelations)

      await updateConcept(mockEvent)

      // Check if captureRelations was called twice (before and after update)
      expect(captureRelations).toHaveBeenCalledTimes(2)

      // Check if sparqlRequest was called to add skos:changeNote
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('skos:changeNote')
      }))

      // Check if the change note includes the correct information, handling missing prefLabels
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Removed broader relation from undefined [123] to undefined [456]')
      }))

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Added broader relation from Concept A [123] to Concept C [789]')
      }))
    })

    test('should handle empty prefLabels when capturing relations', async () => {
      const oldRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: '',
          toPrefLabel: ''
        }
      ]
      const newRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept C'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(oldRelations)
        .mockResolvedValueOnce(newRelations)

      await updateConcept(mockEvent)

      // Check if captureRelations was called twice (before and after update)
      expect(captureRelations).toHaveBeenCalledTimes(2)

      // Check if sparqlRequest was called to add skos:changeNote
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('skos:changeNote')
      }))

      // Check if the change note includes the correct information, handling empty prefLabels
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Removed broader relation from  [123] to  [456]')
      }))

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Added broader relation from Concept A [123] to Concept C [789]')
      }))
    })

    test('should handle special characters in prefLabels when capturing relations', async () => {
      const oldRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept "A" & B',
          toPrefLabel: 'Concept C > D'
        }
      ]
      const newRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
          fromPrefLabel: 'Concept E < F',
          toPrefLabel: 'Concept "G" & H'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(oldRelations)
        .mockResolvedValueOnce(newRelations)

      await updateConcept(mockEvent)

      // Check if captureRelations was called twice (before and after update)
      expect(captureRelations).toHaveBeenCalledTimes(2)

      // Check if sparqlRequest was called to add skos:changeNote
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('skos:changeNote')
      }))

      // Check if the change note includes the correct information, handling special characters in prefLabels
      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Removed broader relation from Concept "A" & B [123] to Concept C > D [456]')
      }))

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Added broader relation from Concept E < F [123] to Concept "G" & H [789]')
      }))
    })

    test('should not add change notes when there are no relation changes', async () => {
      const relations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(relations)
        .mockResolvedValueOnce(relations)

      await updateConcept(mockEvent)

      expect(sparqlRequest).not.toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('skos:changeNote')
      }))
    })

    test('should handle multiple relation changes', async () => {
      const oldRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]
      const newRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'narrower',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept C'
        },
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'related',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/012',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept D'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(oldRelations)
        .mockResolvedValueOnce(newRelations)

      await updateConcept(mockEvent)

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Removed broader relation from Concept A [123] to Concept B [456]')
      }))

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Added narrower relation from Concept A [123] to Concept C [789]')
      }))

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Added related relation from Concept A [123] to Concept D [012]')
      }))
    })

    test('should handle changes in relation type', async () => {
      const oldRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]
      const newRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'narrower',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(oldRelations)
        .mockResolvedValueOnce(newRelations)

      await updateConcept(mockEvent)

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Removed broader relation from Concept A [123] to Concept B [456]')
      }))

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('Added narrower relation from Concept A [123] to Concept B [456]')
      }))
    })

    test('should handle changes in prefLabels without relation changes', async () => {
      const oldRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]
      const newRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A Updated',
          toPrefLabel: 'Concept B Updated'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(oldRelations)
        .mockResolvedValueOnce(newRelations)

      await updateConcept(mockEvent)

      // No change notes should be added for prefLabel changes only
      expect(sparqlRequest).not.toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('skos:changeNote')
      }))
    })

    test('should handle no changes in relations', async () => {
      const relations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]

      captureRelations
        .mockResolvedValueOnce(relations)
        .mockResolvedValueOnce(relations)

      await updateConcept(mockEvent)

      // Check if captureRelations was called twice (before and after update)
      expect(captureRelations).toHaveBeenCalledTimes(2)

      // Check that no change notes were added
      expect(sparqlRequest).not.toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining('skos:changeNote')
      }))
    })
  })
})
