import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import * as getConfigModule from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { status } from '../handler'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/sparqlRequest')

describe('status handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.RDF4J_SERVICE_URL = 'http://test-rdf4j-server.com'
  })

  afterEach(() => {
    vi.resetAllMocks()
    delete process.env.RDF4J_SERVICE_URL
  })

  describe('when successful', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      })

      getConfigModule.getApplicationConfig.mockReturnValue({
        defaultResponseHeaders: { 'X-Test': 'test-header' }
      })

      sparqlRequest.mockResolvedValue({
        json: () => Promise.resolve({
          results: {
            bindings: [{ count: { value: '1000000' } }]
          }
        })
      })
    })

    test('should return a 200 status code and healthy message with triple count', async () => {
      const result = await status()

      expect(result.statusCode).toBe(200)
      expect(result.body).toBe('Database connection healthy.  1000000 triples in published version.')
      expect(result.headers['Content-Type']).toBe('text/plain')
      expect(result.headers['X-Test']).toBe('test-header')
    })

    test('should call fetch with the correct URL', async () => {
      await status()

      expect(global.fetch).toHaveBeenCalledWith('http://test-rdf4j-server.com/rdf4j-server/protocol')
    })

    test('should call sparqlRequest with the correct parameters', async () => {
      await status()

      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        body: expect.stringContaining('SELECT (COUNT(*) AS ?count)'),
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        version: 'published'
      })
    })
  })

  describe('when unsuccessful', () => {
    beforeEach(() => {
      getConfigModule.getApplicationConfig.mockReturnValue({
        defaultResponseHeaders: { 'X-Test': 'test-header' }
      })

      console.error = vi.fn() // Mock console.error to prevent output during tests
    })

    test('should return a 500 status code when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await status()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to fetch RDF4J status')
      expect(result.headers['X-Test']).toBe('test-header')
    })

    test('should return a 500 status code when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const result = await status()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to fetch RDF4J status')
      expect(result.headers['X-Test']).toBe('test-header')
    })

    test('should return a 500 status code when sparqlRequest fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      })

      sparqlRequest.mockRejectedValue(new Error('SPARQL query failed'))

      const result = await status()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to fetch RDF4J status')
      expect(result.headers['X-Test']).toBe('test-header')
    })

    test('should log the error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await status()

      expect(console.error).toHaveBeenCalledWith('Error fetching RDF4J status:', expect.any(Error))
      expect(console.error).toHaveBeenCalledWith('RDF4J Service URL:', 'http://test-rdf4j-server.com')
      expect(console.error).toHaveBeenCalledWith('Full error object:', expect.any(String))
    })
  })
})
