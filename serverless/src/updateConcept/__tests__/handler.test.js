import {
  describe,
  expect,
  vi,
  beforeEach
} from 'vitest'
import updateConcept from '../handler'
import conceptIdExists from '../../utils/conceptIdExists'
import { getApplicationConfig } from '../../utils/getConfig'
import { sparqlRequest } from '../../utils/sparqlRequest'

// Mock the dependencies
vi.mock('../../utils/conceptIdExists')
vi.mock('../../utils/getConfig')
vi.mock('../../utils/sparqlRequest')

describe('updateConcept', () => {
  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  const mockEvent = {
    body: '<rdf:RDF>...</rdf:RDF>',
    pathParameters: { conceptId: '123' }
  }

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
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

  test('should update concept and return 200 if concept exists', async () => {
    conceptIdExists.mockResolvedValue(true)
    sparqlRequest.mockResolvedValue({ ok: true })

    const result = await updateConcept(mockEvent)

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

  test('should return 500 if sparqlRequest fails', async () => {
    conceptIdExists.mockResolvedValue(true)
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    })

    const result = await updateConcept(mockEvent)

    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: 'HTTP error! status: 500'
      }),
      headers: mockDefaultHeaders
    })
  })

  test('should return 500 if an error is thrown', async () => {
    conceptIdExists.mockResolvedValue(true)
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    const result = await updateConcept(mockEvent)

    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating concept',
        error: 'Network error'
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
