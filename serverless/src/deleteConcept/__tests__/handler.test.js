import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach
} from 'vitest'
import deleteConcept from '../handler'
import { getApplicationConfig } from '../../utils/getConfig'
import { sparqlRequest } from '../../utils/sparqlRequest'

// Mock the dependencies
vi.mock('../../utils/getConfig')
vi.mock('../../utils/sparqlRequest')

describe('deleteConcept', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }
  const mockConceptId = '123'
  const mockEvent = {
    pathParameters: { conceptId: mockConceptId }
  }
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })

    // Set up spies for console.log and console.error
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore the original console methods after each test
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('should successfully delete a concept and return 200', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    const result = await deleteConcept(mockEvent)

    expect(sparqlRequest).toHaveBeenCalledWith({
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      path: '/statements',
      method: 'POST',
      body: expect.stringContaining(`https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}`)
    })

    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully deleted concept: ${mockConceptId}` }),
      headers: mockDefaultHeaders
    })

    expect(consoleLogSpy).toHaveBeenCalledWith(`Successfully deleted concept: ${mockConceptId}`)
  })

  test('should handle SPARQL endpoint errors and return 500', async () => {
    const errorMessage = 'SPARQL endpoint error'
    sparqlRequest.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(errorMessage)
    })

    const result = await deleteConcept(mockEvent)

    expect(sparqlRequest).toHaveBeenCalled()
    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting concept',
        error: 'HTTP error! status: 400'
      }),
      headers: mockDefaultHeaders
    })

    expect(consoleLogSpy).toHaveBeenCalledWith('Response text:', errorMessage)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting concept:', expect.any(Error))
  })

  test('should handle unexpected errors and return 500', async () => {
    const error = new Error('Unexpected error')
    sparqlRequest.mockRejectedValue(error)

    const result = await deleteConcept(mockEvent)

    expect(sparqlRequest).toHaveBeenCalled()
    expect(result).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting concept',
        error: 'Unexpected error'
      }),
      headers: mockDefaultHeaders
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting concept:', error)
  })

  test('should construct the correct SPARQL query', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await deleteConcept(mockEvent)

    const expectedQuery = `
     PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
     DELETE {
       ?s ?p ?o .
     }
     WHERE {
       ?s ?p ?o .
       FILTER(?s = <https://gcmd.earthdata.nasa.gov/kms/concept/${mockConceptId}>)
     }
   `

    expect(sparqlRequest).toHaveBeenCalledWith({
      accept: 'application/sparql-results+json',
      body: expectedQuery,
      contentType: 'application/sparql-update',
      method: 'POST',
      path: '/statements'
    })
  })

  test('should handle missing conceptId in path parameters', async () => {
    const eventWithoutConceptId = { pathParameters: {} }

    const result = await deleteConcept(eventWithoutConceptId)

    expect(result).toEqual({
      statusCode: 500,
      body: expect.stringContaining('Error deleting concept'),
      headers: mockDefaultHeaders
    })

    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  test('should use the correct content type and accept headers', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await deleteConcept(mockEvent)

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json'
      })
    )
  })

  test('should use the correct path and method for the SPARQL request', async () => {
    sparqlRequest.mockResolvedValue({ ok: true })

    await deleteConcept(mockEvent)

    expect(sparqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/statements',
        method: 'POST'
      })
    )
  })
})
