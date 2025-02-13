import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from 'vitest'
import createConcept from '../handler'
import conceptIdExists from '../../utils/conceptIdExists'
import { getApplicationConfig } from '../../utils/getConfig'
import { sparqlRequest } from '../../utils/sparqlRequest'

// Mock the dependencies
vi.mock('../../utils/conceptIdExists')
vi.mock('../../utils/getConfig')
vi.mock('../../utils/sparqlRequest')

describe('createConcept', () => {
  const mockEvent = {
    body: '<rdf:RDF>...</rdf:RDF>',
    pathParameters: { conceptId: '123' }
  }

  const mockDefaultHeaders = { 'Content-Type': 'application/json' }
  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  test('should return 404 if concept already exists', async () => {
    conceptIdExists.mockResolvedValue(true)

    const result = await createConcept(mockEvent)

    expect(result).toEqual({
      statusCode: 404,
      body: JSON.stringify({ message: 'Concept https://gcmd.earthdata.nasa.gov/kms/concept/123 already exists.' }),
      headers: mockDefaultHeaders
    })
  })

  test('should create concept and return 200 if concept does not exist', async () => {
    conceptIdExists.mockResolvedValue(false)
    sparqlRequest.mockResolvedValue({ ok: true })

    const result = await createConcept(mockEvent)

    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      path: '/statements',
      method: 'POST',
      body: mockEvent.body
    })

    expect(result).toEqual({
      statusCode: 200,
      body: 'Successfully loaded RDF XML into RDF4J',
      headers: mockDefaultHeaders
    })
  })

  test('should return 500 if sparqlRequest fails', async () => {
    conceptIdExists.mockResolvedValue(false)
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    })

    const result = await createConcept(mockEvent)

    expect(result).toEqual({
      statusCode: 500,
      body: 'Error loading RDF XML into RDF4J',
      headers: mockDefaultHeaders
    })
  })

  test('should return 500 if an error is thrown', async () => {
    conceptIdExists.mockResolvedValue(false)
    sparqlRequest.mockRejectedValue(new Error('Network error'))

    const result = await createConcept(mockEvent)

    expect(result).toEqual({
      statusCode: 500,
      body: 'Error loading RDF XML into RDF4J',
      headers: mockDefaultHeaders
    })
  })
})
