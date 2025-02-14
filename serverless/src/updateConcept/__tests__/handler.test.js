import {
  describe,
  expect,
  vi,
  beforeEach,
  test
} from 'vitest'
import updateConcept from '../handler'
import conceptIdExists from '../../utils/conceptIdExists'
import deleteTriples from '../../utils/deleteTriples'
import rollback from '../../utils/rollback'
import getConceptId from '../../utils/getConceptId'
import { getApplicationConfig } from '../../utils/getConfig'
import { sparqlRequest } from '../../utils/sparqlRequest'

// Mock the dependencies
vi.mock('../../utils/conceptIdExists')
vi.mock('../../utils/deleteTriples')
vi.mock('../../utils/rollback')
vi.mock('../../utils/getConceptId')
vi.mock('../../utils/getConfig')
vi.mock('../../utils/sparqlRequest')

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

  test('should update concept and return 200 if concept exists and update succeeds', async () => {
    conceptIdExists.mockResolvedValue(true)
    sparqlRequest.mockResolvedValue({ ok: true })

    const result = await updateConcept(mockEvent)

    expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: mockRdfXml
    })

    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully updated concept: 123' }),
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
    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: mockRdfXml
    })

    expect(rollback).toHaveBeenCalledWith(mockDeletedTriples)

    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: 'HTTP error! insert status: 500'
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
    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
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

  test('should return 500 if rollback fails', async () => {
    conceptIdExists.mockResolvedValue(true)
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500
    })

    rollback.mockRejectedValue(new Error('Rollback failed'))

    const result = await updateConcept(mockEvent)

    expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(sparqlRequest).toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledWith(mockDeletedTriples)

    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: 'Rollback failed'
      }),
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
    expect(conceptIdExists).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: 'Database error'
      }),
      headers: mockDefaultHeaders
    })
  })

  test('should handle sparqlRequest throwing an error', async () => {
    conceptIdExists.mockResolvedValue(true)
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    const result = await updateConcept(mockEvent)

    expect(getConceptId).toHaveBeenCalledWith(mockRdfXml)
    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(sparqlRequest).toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledWith(mockDeletedTriples)
    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: 'Network error'
      }),
      headers: mockDefaultHeaders
    })
  })
})
