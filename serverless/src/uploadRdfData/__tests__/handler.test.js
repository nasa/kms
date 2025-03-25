import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'
import { uploadRdfData } from '@/uploadRdfData/handler'

// Mock the dependencies
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')

describe('uploadRdfData', () => {
  const mockDefaultHeaders = { 'X-Custom-Header': 'value' }

  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: mockDefaultHeaders })
  })

  describe('when successful', () => {
    test('should successfully upload RDF data and return 200', async () => {
      const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
      const event = { body: mockRdfXml }
      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await uploadRdfData(event)

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
        body: JSON.stringify({
          message: 'Successfully loaded RDF data into RDF4J'
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })

    test('should use provided version', async () => {
      const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
      const event = {
        body: mockRdfXml,
        queryStringParameters: { version: 'published' }
      }
      sparqlRequest.mockResolvedValue({ ok: true })

      await uploadRdfData(event)

      expect(sparqlRequest).toHaveBeenCalledWith(expect.objectContaining({
        version: 'published'
      }))
    })
  })

  describe('when unsuccessful', () => {
    test('should return 400 if RDF/XML data is missing', async () => {
      const event = { body: null }
      const result = await uploadRdfData(event)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid input: RDF/XML data is required' }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })

    test('should handle SPARQL endpoint errors', async () => {
      const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
      const event = { body: mockRdfXml }
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      })

      const result = await uploadRdfData(event)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error from SPARQL endpoint: Bad Request'
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })

    test('should handle unexpected errors', async () => {
      const mockRdfXml = '<rdf:RDF>...</rdf:RDF>'
      const event = { body: mockRdfXml }
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      const result = await uploadRdfData(event)

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error loading RDF XML into RDF4J',
          error: 'Network error'
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })

      expect(console.error).toHaveBeenCalledWith('Error loading RDF data into RDF4J:', expect.any(Error))
    })
  })
})
