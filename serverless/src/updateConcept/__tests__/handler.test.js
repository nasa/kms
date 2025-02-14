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
import { getApplicationConfig } from '../../utils/getConfig'
import { sparqlRequest } from '../../utils/sparqlRequest'

// Mock the dependencies
vi.mock('../../utils/conceptIdExists')
vi.mock('../../utils/deleteTriples')
vi.mock('../../utils/rollback')
vi.mock('../../utils/getConfig')
vi.mock('../../utils/sparqlRequest')

describe('updateConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockEvent = {
    body: '<rdf:RDF>...</rdf:RDF>',
    pathParameters: { conceptId: '123' }
  }
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
    deleteTriples.mockResolvedValue({
      deletedTriples: mockDeletedTriples,
      deleteResponse: { ok: true }
    })

    rollback.mockResolvedValue()
  })

  test('should return 404 if concept does not exist', async () => {
    conceptIdExists.mockResolvedValue(false)

    const result = await updateConcept(mockEvent)

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

    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: mockEvent.body
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

    expect(deleteTriples).toHaveBeenCalledWith('https://gcmd.earthdata.nasa.gov/kms/concept/123')
    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: mockEvent.body
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

  test('should handle missing conceptId in path parameters', async () => {
    const eventWithoutConceptId = {
      body: '<rdf:RDF>...</rdf:RDF>',
      pathParameters: {}
    }

    const result = await updateConcept(eventWithoutConceptId)

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body).message).toContain('not found')
  })
})
