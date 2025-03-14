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
import { sparqlRequest } from '@/shared/sparqlRequest'

// Mock the dependencies
vi.mock('@/shared/conceptIdExists')
vi.mock('@/shared/getConceptId')
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')

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
  })

  describe('when successful', () => {
    test('should successfully create a concept', async () => {
      conceptIdExists.mockResolvedValue(false)
      sparqlRequest.mockResolvedValue({ ok: true })

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

      expect(result).toEqual({
        statusCode: 201,
        body: JSON.stringify({
          message: 'Successfully created concept',
          conceptId: mockConceptId
        }),
        headers: mockDefaultHeaders
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
})
