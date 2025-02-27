import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getApplicationConfig } from '../getConfig'
import { sparqlRequest } from '../sparqlRequest'

vi.mock('../getConfig', () => ({
  getApplicationConfig: vi.fn()
}))

global.fetch = vi.fn()

describe('sparqlRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    process.env.RDFDB_BASE_URL = 'http://test-server.com'
    process.env.RDFDB_USER_NAME = 'testuser'
    process.env.RDFDB_PASSWORD = 'testpass'

    getApplicationConfig.mockReturnValue({
      sparqlQueryEndpoint: 'http://test-server.com/query-endpoint',
      sparqlUpdateEndpoint: 'http://test-server.com/update-endpoint/statements',
      sparqlDataEndpoint: 'http://test-server.com/data-endpoint'
    })
  })

  afterEach(() => {
    delete process.env.RDFDB_BASE_URL
    delete process.env.RDFDB_USER_NAME
    delete process.env.RDFDB_PASSWORD
  })

  describe('when querying', () => {
    test('should make a query request with correct URL and headers', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        type: 'query',
        method: 'POST',
        body: 'SELECT * WHERE { ?s ?p ?o }',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-server.com/query-endpoint',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sparql-query',
            Accept: 'application/sparql-results+json',
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          },
          body: 'SELECT * WHERE { ?s ?p ?o }'
        }
      )
    })

    test('should use default content type and accept headers if not provided', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        type: 'query',
        method: 'GET'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-server.com/query-endpoint',
        {
          method: 'GET',
          headers: {
            'Content-Type': undefined,
            Accept: undefined,
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          }
        }
      )
    })
  })

  describe('when updating triples', () => {
    test('should make an update request with correct URL and headers', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        type: 'update',
        method: 'POST',
        body: 'INSERT DATA { <http://example/book1> <http://example.org/ns#title> "A new book" }',
        contentType: 'application/sparql-update',
        accept: 'application/json'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-server.com/update-endpoint/statements',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sparql-update',
            Accept: 'application/json',
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          },
          body: 'INSERT DATA { <http://example/book1> <http://example.org/ns#title> "A new book" }'
        }
      )
    })

    test('should use default content type and accept headers if not provided', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        type: 'update',
        method: 'POST',
        body: 'DELETE WHERE { ?s ?p ?o }'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-server.com/update-endpoint/statements',
        {
          method: 'POST',
          headers: {
            'Content-Type': undefined,
            Accept: undefined,
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          },
          body: 'DELETE WHERE { ?s ?p ?o }'
        }
      )
    })
  })

  describe('when loading rdf/xml', () => {
    test('should make a data request with correct URL and headers', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        type: 'data',
        method: 'POST',
        body: '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="http://example/book1"><ns:title xmlns:ns="http://example.org/ns#">A new book</ns:title></rdf:Description></rdf:RDF>',
        contentType: 'application/rdf+xml',
        accept: 'application/json'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-server.com/data-endpoint',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/rdf+xml',
            Accept: 'application/json',
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          },
          body: '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="http://example/book1"><ns:title xmlns:ns="http://example.org/ns#">A new book</ns:title></rdf:Description></rdf:RDF>'
        }
      )
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error if fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))

      await expect(sparqlRequest({
        type: 'query',
        method: 'GET',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json'
      })).rejects.toThrow('Network error')
    })

    test('should throw an error for invalid type', async () => {
      await expect(sparqlRequest({
        type: 'invalid',
        method: 'GET',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json'
      })).rejects.toThrow('Invalid sparql query type')
    })
  })

  describe('when authenticating', () => {
    test('should use correct authentication header', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        type: 'query',
        method: 'GET',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          })
        })
      )
    })
  })
})
