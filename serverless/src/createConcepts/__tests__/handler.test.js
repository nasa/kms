import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { createConcepts } from '@/createConcepts/handler'
import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

// Mock the dependencies
vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')

describe('createConcepts', () => {
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
    test('should successfully create multiple concepts and return 200', async () => {
      const mockRdfXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="concept1"/>
          <skos:Concept rdf:about="concept2"/>
        </rdf:RDF>
      `
      const event = { body: mockRdfXml }
      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await createConcepts(event)

      expect(sparqlRequest).toHaveBeenCalledWith({
        type: 'data',
        contentType: 'application/rdf+xml',
        accept: 'application/rdf+xml',
        method: 'POST',
        body: mockRdfXml
      })

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Successfully loaded RDF XML into RDFDB',
          conceptsLoaded: 2
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })

    test('should successfully create a single concept and return 200', async () => {
      const mockRdfXml = `
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
          <skos:Concept rdf:about="concept1"/>
        </rdf:RDF>
      `
      const event = { body: mockRdfXml }
      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await createConcepts(event)

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Successfully loaded RDF XML into RDFDB',
          conceptsLoaded: 1
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })

    test('should handle empty RDF/XML with no concepts', async () => {
      const emptyRdfXml = '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#"></rdf:RDF>'
      const event = { body: emptyRdfXml }
      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await createConcepts(event)

      expect(result).toEqual({
        statusCode: 200,
        body: JSON.stringify({
          message: 'Successfully loaded RDF XML into RDFDB',
          conceptsLoaded: 0
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should return 400 if RDF/XML data is missing', async () => {
      const event = { body: null }
      const result = await createConcepts(event)

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
      const mockRdfXml = '<rdf:RDF><skos:Concept rdf:about="concept1"/></rdf:RDF>'
      const event = { body: mockRdfXml }
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      })

      const result = await createConcepts(event)

      expect(result).toEqual({
        statusCode: 400,
        body: JSON.stringify({
          message: 'Error from SPARQL endpoint: Bad Request',
          conceptsAttempted: 1
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })

    test('should handle unexpected errors', async () => {
      const mockRdfXml = '<rdf:RDF><skos:Concept rdf:about="concept1"/></rdf:RDF>'
      const event = { body: mockRdfXml }
      sparqlRequest.mockRejectedValue(new Error('Network error'))

      const result = await createConcepts(event)

      expect(result).toEqual({
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error loading RDF XML into RDFDB',
          error: 'Network error',
          conceptsAttempted: 1
        }),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })
    })

    test('should handle invalid XML', async () => {
      const invalidXml = '<invalid>XML</invalid>'
      const event = { body: invalidXml }

      const result = await createConcepts(event)

      expect(result).toEqual({
        statusCode: 500,
        body: expect.stringContaining('Error loading RDF XML into RDFDB'),
        headers: {
          ...mockDefaultHeaders,
          'Content-Type': 'application/json'
        }
      })

      expect(JSON.parse(result.body).conceptsAttempted).toBe(0)
    })
  })
})
