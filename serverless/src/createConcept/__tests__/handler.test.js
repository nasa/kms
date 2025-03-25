import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createConcept } from '@/createConcept/handler'
import { conceptIdExists } from '@/shared/conceptIdExists'
import { getConceptId } from '@/shared/getConceptId'
import { getApplicationConfig } from '@/shared/getConfig'
import { getCreatedDate } from '@/shared/getCreatedDate'
import { getModifiedDate } from '@/shared/getModifiedDate'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { updateCreatedDate } from '@/shared/updateCreatedDate'
import { updateModifiedDate } from '@/shared/updateModifiedDate'

// Mock the dependencies
vi.mock('@/shared/conceptIdExists')
vi.mock('@/shared/getConceptId')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')
vi.mock('@/shared/getCreatedDate')
vi.mock('@/shared/getModifiedDate')
vi.mock('@/shared/updateCreatedDate')
vi.mock('@/shared/updateModifiedDate')

describe('createConcept', () => {
  const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
  const mockEvent = { body: mockRdfXml }
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockConceptId = '123'
  const mockConceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
    getConceptId.mockReturnValue(mockConceptId)
    vi.spyOn(console, 'log').mockImplementation(() => {})
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
      getCreatedDate.mockResolvedValue(null)
      getModifiedDate.mockResolvedValue(null)
      updateCreatedDate.mockResolvedValue(true)
      updateModifiedDate.mockResolvedValue(true)

      const result = await createConcept(mockEvent)

      expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
      expect(conceptIdExists).toHaveBeenCalledWith(mockConceptIRI, 'draft')
      expect(sparqlRequest).toHaveBeenCalledWith({
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        path: '/statements',
        method: 'POST',
        body: mockRdfXml,
        version: 'draft'
      })

      expect(getCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(getModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(updateCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate)
      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate)

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.body)).toEqual({
        message: 'Successfully created concept',
        conceptId: mockConceptId
      })
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

      expect(console.log).toHaveBeenCalledWith('Response text:', 'Internal Server Error')
    })

    test('should handle conceptIdExists throwing an error', async () => {
      conceptIdExists.mockRejectedValue(new Error('Database error'))

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: 'Database error'
        }),
        headers: mockDefaultHeaders
      })
    })

    test('should handle sparqlRequest throwing an error', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      const result = await createConcept(mockEvent)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error creating concept',
          error: 'Network error'
        }),
        headers: mockDefaultHeaders
      })
    })
  })

  describe('when updating created and modified dates', () => {
    const mockDate = '2023-05-15T10:30:00.000Z'

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(mockDate))
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('should add both creation and modified dates when neither exist', async () => {
      getCreatedDate.mockResolvedValue(null)
      getModifiedDate.mockResolvedValue(null)
      updateCreatedDate.mockResolvedValue(true)
      updateModifiedDate.mockResolvedValue(true)

      await createConcept(mockEvent)

      expect(getCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(getModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(updateCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate)
      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate)
      expect(console.log).toHaveBeenCalledWith(`Added creation date ${mockDate} for concept ${mockConceptId}`)
      expect(console.log).toHaveBeenCalledWith(`Updated modified date ${mockDate} for concept ${mockConceptId}`)
    })

    test('should add only creation date when it does not exist but modified date does', async () => {
      getCreatedDate.mockResolvedValue(null)
      getModifiedDate.mockResolvedValue('2023-05-14T10:30:00.000Z')
      updateCreatedDate.mockResolvedValue(true)

      await createConcept(mockEvent)

      expect(getCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(getModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(updateCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate)
      expect(updateModifiedDate).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalledWith(`Added creation date ${mockDate} for concept ${mockConceptId}`)
    })

    test('should add only modified date when it does not exist but creation date does', async () => {
      getCreatedDate.mockResolvedValue('2023-05-14T10:30:00.000Z')
      getModifiedDate.mockResolvedValue(null)
      updateModifiedDate.mockResolvedValue(true)

      await createConcept(mockEvent)

      expect(getCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(getModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(updateCreatedDate).not.toHaveBeenCalled()
      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', mockDate)
      expect(console.log).toHaveBeenCalledWith(`Updated modified date ${mockDate} for concept ${mockConceptId}`)
    })

    test('should not update any dates when both already exist', async () => {
      const existingDate = '2023-05-14T10:30:00.000Z'
      getCreatedDate.mockResolvedValue(existingDate)
      getModifiedDate.mockResolvedValue(existingDate)

      await createConcept(mockEvent)

      expect(getCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(getModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(updateCreatedDate).not.toHaveBeenCalled()
      expect(updateModifiedDate).not.toHaveBeenCalled()
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Added creation date'))
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Updated modified date'))
    })

    test('should handle failure to add creation date', async () => {
      getCreatedDate.mockResolvedValue(null)
      getModifiedDate.mockResolvedValue('2023-05-14T10:30:00.000Z')
      updateCreatedDate.mockResolvedValue(false)

      await createConcept(mockEvent)

      expect(getCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(updateCreatedDate).toHaveBeenCalledWith(mockConceptId, 'draft', expect.any(String))
      expect(console.warn).toHaveBeenCalledWith(`Failed to add creation date for concept ${mockConceptId}`)
      expect(updateModifiedDate).not.toHaveBeenCalled()
    })

    test('should handle failure to update modified date', async () => {
      getCreatedDate.mockResolvedValue('2023-05-14T10:30:00.000Z')
      getModifiedDate.mockResolvedValue(null)
      updateModifiedDate.mockResolvedValue(false)

      await createConcept(mockEvent)

      expect(getModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft')
      expect(updateModifiedDate).toHaveBeenCalledWith(mockConceptId, 'draft', expect.any(String))
      expect(console.warn).toHaveBeenCalledWith(`Failed to update modified date for concept ${mockConceptId}`)
      expect(updateCreatedDate).not.toHaveBeenCalled()
    })
  })
})
