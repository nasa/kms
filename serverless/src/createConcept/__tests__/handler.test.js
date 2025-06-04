import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createConcept } from '@/createConcept/handler'
import { addChangeNotes } from '@/shared/addChangeNotes'
import { captureRelations } from '@/shared/captureRelations'
import { compareRelations } from '@/shared/compareRelations'
import { conceptIdExists } from '@/shared/conceptIdExists'
import { ensureReciprocal } from '@/shared/ensureReciprocal'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'
import {
  commitTransaction,
  rollbackTransaction,
  startTransaction
} from '@/shared/transactionHelpers'
import { updateCreatedDate } from '@/shared/updateCreatedDate'
import { updateModifiedDate } from '@/shared/updateModifiedDate'

// Mock the dependencies
vi.mock('@/shared/conceptIdExists')
vi.mock('@/shared/ensureReciprocal')
vi.mock('@/shared/getConceptId')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/updateCreatedDate')
vi.mock('@/shared/updateModifiedDate')
vi.mock('@/shared/transactionHelpers')
vi.mock('@/shared/captureRelations')
vi.mock('@/shared/addChangeNotes')
vi.mock('@/shared/compareRelations')

describe('createConcept', () => {
  const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
  const mockEvent = { body: mockRdfXml }
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockConceptId = '123'
  const mockConceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`
  const mockTransactionUrl = 'mock-transaction-url'

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    getConceptId.mockReturnValue(mockConceptId)
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

    compareRelations.mockReturnValue({
      addedRelations: [],
      removedRelations: []
    })

    addChangeNotes.mockResolvedValue(true)

    startTransaction.mockResolvedValue(mockTransactionUrl)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should successfully create a concept and update dates', async () => {
      const mockDate = '2023-05-15T10:30:00.000Z'
      vi.useFakeTimers()
      vi.setSystemTime(new Date(mockDate))

      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
      updateCreatedDate.mockResolvedValue(true)
      updateModifiedDate.mockResolvedValue(true)
      commitTransaction.mockResolvedValue()

      const result = await createConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(conceptIdExists).toHaveBeenCalledWith(mockConceptIRI, 'draft')
      expect(startTransaction).toHaveBeenCalled()
      expect(sparqlRequest).toHaveBeenCalledWith({
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        method: 'POST',
        body: mockRdfXml,
        version: 'draft',
        transaction: {
          transactionUrl: mockTransactionUrl,
          action: 'ADD'
        }
      })

      expect(ensureReciprocal).toHaveBeenCalledWith({
        oldRdfXml: null,
        newRdfXml: mockRdfXml,
        conceptId: mockConceptId,
        version: 'draft',
        transactionUrl: mockTransactionUrl
      })

      expect(updateCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate, mockTransactionUrl)
      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate, mockTransactionUrl)
      expect(commitTransaction).toHaveBeenCalledWith(mockTransactionUrl)

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Successfully created concept',
        conceptId: mockConceptId
      })

      vi.useRealTimers()
    })
  })

  describe('when provding a version', () => {
    test('should use provided version for queries', async () => {
      const customVersion = 'custom-version'
      const mockEventWithVersion = {
        body: mockRdfXml,
        queryStringParameters: { version: customVersion }
      }

      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
      updateCreatedDate.mockResolvedValue(true)
      updateModifiedDate.mockResolvedValue(true)

      await createConcept(mockEventWithVersion)

      expect(conceptIdExists)
        .toHaveBeenCalledWith(mockConceptIRI, customVersion)

      expect(sparqlRequest)
        .toHaveBeenCalledWith(expect.objectContaining({ version: customVersion }))

      expect(ensureReciprocal)
        .toHaveBeenCalledWith(expect.objectContaining({ version: customVersion }))

      expect(updateCreatedDate)
        .toHaveBeenCalledWith(mockConceptId, customVersion, expect.any(String), mockTransactionUrl)

      expect(updateModifiedDate)
        .toHaveBeenCalledWith(mockConceptId, customVersion, expect.any(String), mockTransactionUrl)
    })
  })

  describe('when unsuccessful', () => {
    test('should handle missing body in event', async () => {
      const eventWithoutBody = {}

      const result = await createConcept(eventWithoutBody)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: 'Missing RDF/XML data in request body'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should return 409 if concept already exists', async () => {
      conceptIdExists.mockResolvedValue(true)

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 409,
        body: JSON.stringify({ message: `Concept ${mockConceptIRI} already exists.` }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle getConceptId throwing an error', async () => {
      getConceptId.mockImplementation(() => {
        throw new Error('Invalid XML')
      })

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: 'Invalid XML'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle missing concept ID', async () => {
      getConceptId.mockReturnValue(null)

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: 'Invalid or missing concept ID'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle sparqlRequest failure', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      })

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: 'HTTP error! status: 500'
        }),
        headers: mockDefaultHeaders
      })

      expect(console.error).toHaveBeenCalledWith('Response text:', 'Internal Server Error')
      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
    })

    test('should handle ensureReciprocal failure', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockRejectedValue(new Error('Failed to ensure reciprocal relations'))

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: 'Failed to ensure reciprocal relations'
        }),
        headers: mockDefaultHeaders
      })

      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
    })

    test('should handle updateCreatedDate failure', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
      updateCreatedDate.mockResolvedValue(false)

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: `Failed to add creation date for concept ${mockConceptId}`
        }),
        headers: mockDefaultHeaders
      })

      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
    })

    test('should handle updateCreatedDate throwing an error', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
      updateCreatedDate.mockRejectedValue(new Error(`Failed to add creation date for concept ${mockConceptId}`))

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: `Failed to add creation date for concept ${mockConceptId}`
        }),
        headers: mockDefaultHeaders
      })

      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
    })

    test('should handle updateModifiedDate failure', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
      updateCreatedDate.mockResolvedValue(true)
      updateModifiedDate.mockResolvedValue(false)

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: `Failed to update modified date for concept ${mockConceptId}`
        }),
        headers: mockDefaultHeaders
      })

      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
    })

    test('should handle rollback failure', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockRejectedValue(new Error('Failed to ensure reciprocal relations'))
      rollbackTransaction.mockRejectedValue(new Error('Rollback failed'))

      const consoleErrorSpy = vi.spyOn(console, 'error')

      await createConcept(mockEvent)

      expect(rollbackTransaction).toHaveBeenCalledWith(mockTransactionUrl)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error rolling back transaction:', expect.any(Error))
    })
  })

  describe('when capturing relations', () => {
    test('should capture relations and add change notes when creating a concept', async () => {
      const mockRelations = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
          fromPrefLabel: 'Concept A',
          toPrefLabel: 'Concept B'
        }
      ]

      captureRelations
        .mockResolvedValueOnce([]) // No relations before creation
        .mockResolvedValueOnce(mockRelations) // Relations after creation

      compareRelations.mockReturnValue({
        addedRelations: mockRelations,
        removedRelations: []
      })

      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
      updateCreatedDate.mockResolvedValue(true)
      updateModifiedDate.mockResolvedValue(true)
      addChangeNotes.mockResolvedValue(true)

      await createConcept(mockEvent)

      // Check if captureRelations was called twice (before and after creation)
      expect(captureRelations).toHaveBeenCalledTimes(2)

      // Check if compareRelations was called with the correct arguments
      expect(compareRelations).toHaveBeenCalledWith([], mockRelations)

      // Check if addChangeNotes was called with the correct arguments
      expect(addChangeNotes).toHaveBeenCalledWith(
        mockRelations,
        [],
        'draft',
        mockTransactionUrl
      )

      // Verify that the change notes are added to the correct concept
      expect(addChangeNotes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
            fromPrefLabel: 'Concept A',
            toPrefLabel: 'Concept B'
          })
        ]),
        [],
        'draft',
        mockTransactionUrl
      )
    })

    test('should handle missing prefLabels when capturing relations', async () => {
      const mockRelationsWithMissingLabels = [
        {
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          relation: 'broader',
          to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456'
          // FromPrefLabel and toPrefLabel are intentionally missing
        }
      ]

      captureRelations
        .mockResolvedValueOnce([]) // No relations before creation
        .mockResolvedValueOnce(mockRelationsWithMissingLabels) // Relations after creation

      compareRelations.mockReturnValue({
        addedRelations: mockRelationsWithMissingLabels,
        removedRelations: []
      })

      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
      ensureReciprocal.mockResolvedValue({ ok: true })
      updateCreatedDate.mockResolvedValue(true)
      updateModifiedDate.mockResolvedValue(true)
      addChangeNotes.mockResolvedValue(true)

      await createConcept(mockEvent)

      // Check if captureRelations was called twice (before and after creation)
      expect(captureRelations).toHaveBeenCalledTimes(2)

      // Check if compareRelations was called with the correct arguments
      expect(compareRelations).toHaveBeenCalledWith([], mockRelationsWithMissingLabels)

      // Check if addChangeNotes was called with the correct arguments
      expect(addChangeNotes).toHaveBeenCalledWith(
        mockRelationsWithMissingLabels,
        [],
        'draft',
        mockTransactionUrl
      )

      // Verify that the change notes are added to the correct concept
      expect(addChangeNotes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`
            // We're not expecting fromPrefLabel or toPrefLabel here
          })
        ]),
        [],
        'draft',
        mockTransactionUrl
      )
    })
  })

  test('should handle empty prefLabels when capturing relations', async () => {
    const mockRelationsWithEmptyLabels = [
      {
        from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: '',
        toPrefLabel: ''
      }
    ]

    captureRelations
      .mockResolvedValueOnce([]) // No relations before creation
      .mockResolvedValueOnce(mockRelationsWithEmptyLabels) // Relations after creation

    compareRelations.mockReturnValue({
      addedRelations: mockRelationsWithEmptyLabels,
      removedRelations: []
    })

    conceptIdExists.mockResolvedValue(false)
    sparqlRequest.mockResolvedValue({ ok: true })
    ensureReciprocal.mockResolvedValue({ ok: true })
    updateCreatedDate.mockResolvedValue(true)
    updateModifiedDate.mockResolvedValue(true)
    addChangeNotes.mockResolvedValue(true)

    await createConcept(mockEvent)

    // Check if captureRelations was called twice (before and after creation)
    expect(captureRelations).toHaveBeenCalledTimes(2)

    // Check if compareRelations was called with the correct arguments
    expect(compareRelations).toHaveBeenCalledWith([], mockRelationsWithEmptyLabels)

    // Check if addChangeNotes was called with the correct arguments
    expect(addChangeNotes).toHaveBeenCalledWith(
      mockRelationsWithEmptyLabels,
      [],
      'draft',
      mockTransactionUrl
    )

    // Verify that the change notes are added to the correct concept
    expect(addChangeNotes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          fromPrefLabel: '',
          toPrefLabel: ''
        })
      ]),
      [],
      'draft',
      mockTransactionUrl
    )
  })

  // Test for handling relations with special characters in prefLabels
  test('should handle special characters in prefLabels when capturing relations', async () => {
    const mockRelationsWithSpecialChars = [
      {
        from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
        relation: 'broader',
        to: 'https://gcmd.earthdata.nasa.gov/kms/concept/456',
        fromPrefLabel: 'Concept "A" & B',
        toPrefLabel: 'Concept C > D'
      }
    ]

    captureRelations
      .mockResolvedValueOnce([]) // No relations before creation
      .mockResolvedValueOnce(mockRelationsWithSpecialChars) // Relations after creation

    compareRelations.mockReturnValue({
      addedRelations: mockRelationsWithSpecialChars,
      removedRelations: []
    })

    conceptIdExists.mockResolvedValue(false)
    sparqlRequest.mockResolvedValue({ ok: true })
    ensureReciprocal.mockResolvedValue({ ok: true })
    updateCreatedDate.mockResolvedValue(true)
    updateModifiedDate.mockResolvedValue(true)
    addChangeNotes.mockResolvedValue(true)

    await createConcept(mockEvent)

    // Check if captureRelations was called twice (before and after creation)
    expect(captureRelations).toHaveBeenCalledTimes(2)

    // Check if compareRelations was called with the correct arguments
    expect(compareRelations).toHaveBeenCalledWith([], mockRelationsWithSpecialChars)

    // Check if addChangeNotes was called with the correct arguments
    expect(addChangeNotes).toHaveBeenCalledWith(
      mockRelationsWithSpecialChars,
      [],
      'draft',
      mockTransactionUrl
    )

    // Verify that the change notes are added to the correct concept
    expect(addChangeNotes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          from: `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`,
          fromPrefLabel: 'Concept "A" & B',
          toPrefLabel: 'Concept C > D'
        })
      ]),
      [],
      'draft',
      mockTransactionUrl
    )
  })
})
