import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { delay } from '@/shared/delay'

import { resetSparqlRequestStateForTests, sparqlRequest } from '../sparqlRequest'

global.fetch = vi.fn()

describe('sparqlRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSparqlRequestStateForTests()
    vi.mock('@/shared/delay', () => ({
      delay: vi.fn(() => Promise.resolve())
    }))

    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.RDF4J_SERVICE_URL = 'http://test-server.com'
    process.env.RDF4J_USER_NAME = 'testuser'
    process.env.RDF4J_PASSWORD = 'testpass'
  })

  afterEach(() => {
    delete process.env.RDF4J_SERVICE_URL
    delete process.env.RDF4J_USER_NAME
    delete process.env.RDF4J_PASSWORD
    delete process.env.SPARQL_WARM_WINDOW_MS
    delete process.env.SPARQL_WARM_MAX_RETRIES
    delete process.env.SPARQL_COLD_MAX_RETRIES
  })

  describe('when successful', () => {
    describe('when version is specified', () => {
      test('should add WITH clause for SPARQL update', async () => {
        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({})
        }
        global.fetch.mockResolvedValue(mockResponse)

        await sparqlRequest({
          method: 'POST',
          body: 'INSERT DATA { <http://example.org/s> <http://example.org/p> <http://example.org/o> }',
          contentType: 'application/sparql-update',
          version: '1.0'
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('WITH <https://gcmd.earthdata.nasa.gov/kms/version/1.0>')
          })
        )
      })

      test('should add FROM clause for SPARQL query', async () => {
        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({})
        }
        global.fetch.mockResolvedValue(mockResponse)

        await sparqlRequest({
          method: 'POST',
          body: 'SELECT * WHERE { ?s ?p ?o }',
          contentType: 'application/sparql-query',
          version: '2.0'
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('FROM <https://gcmd.earthdata.nasa.gov/kms/version/2.0>')
          })
        )
      })

      test('should not add FROM clause if query already contains one', async () => {
        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({})
        }
        global.fetch.mockResolvedValue(mockResponse)

        const existingQuery = 'SELECT * FROM <http://example.org/graph> WHERE { ?s ?p ?o }'
        await sparqlRequest({
          method: 'POST',
          body: existingQuery,
          contentType: 'application/sparql-query',
          version: '2.0'
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: existingQuery // The query should remain unchanged
          })
        )
      })

      test('should not add WITH clause if update already contains one', async () => {
        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({})
        }
        global.fetch.mockResolvedValue(mockResponse)

        const existingUpdate = 'WITH <http://example.org/graph> INSERT DATA { <http://example.org/s> <http://example.org/p> <http://example.org/o> }'
        await sparqlRequest({
          method: 'POST',
          body: existingUpdate,
          contentType: 'application/sparql-update',
          version: '1.0'
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: existingUpdate // The update should remain unchanged
          })
        )
      })

      test('should use context parameter for RDF/XML data', async () => {
        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({})
        }
        global.fetch.mockResolvedValue(mockResponse)

        await sparqlRequest({
          method: 'POST',
          path: '/statements',
          body: '<rdf:RDF>...</rdf:RDF>',
          contentType: 'application/rdf+xml',
          version: '3.0'
        })

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/statements?context=%3Chttps%3A%2F%2Fgcmd.earthdata.nasa.gov%2Fkms%2Fversion%2F3.0%3E'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/rdf+xml'
            }),
            body: '<rdf:RDF>...</rdf:RDF>'
          })
        )
      })
    })

    test('should make a request with correct URL and headers', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        method: 'POST',
        body: 'SELECT * WHERE { ?s ?p ?o }',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        version: 'draft'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-server.com/rdf4j-server/repositories/kms',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sparql-query',
            Accept: 'application/sparql-results+json',
            Authorization: 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
          },
          body: 'SELECT * FROM <https://gcmd.earthdata.nasa.gov/kms/version/draft> WHERE { ?s ?p ?o }'
        }
      )
    })

    test('should append path to the endpoint URL if provided', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        method: 'GET',
        path: '/custom-path'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test-server.com/rdf4j-server/repositories/kms/custom-path',
        expect.any(Object)
      )
    })

    test('should attach abort signal when timeout is provided', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        method: 'GET',
        timeoutMs: 5
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(Object)
        })
      )
    })

    test('should clear timeout on successful request when timeout is provided', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({
        method: 'GET',
        timeoutMs: 5
      })

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    test('should issue separate requests for identical SPARQL queries', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: { bindings: [] } })
      })

      const request = {
        method: 'POST',
        body: 'SELECT * WHERE { ?s ?p ?o }',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        version: 'draft'
      }

      await Promise.all([sparqlRequest(request), sparqlRequest(request)])

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    test('should use default endpoint URL if RDF4J_SERVICE_URL is not set', async () => {
      delete process.env.RDF4J_SERVICE_URL
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      await sparqlRequest({ method: 'GET' })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/rdf4j-server/repositories/kms',
        expect.any(Object)
      )
    })
  })

  describe('when using transactions', () => {
    test('should handle sparql updates that include transaction', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      const transactionUrl = 'http://test-server.com/rdf4j-server/repositories/kms/transactions/123'
      await sparqlRequest({
        method: 'PUT',
        body: 'UPDATE DATA { <http://example.org/s> <http://example.org/p> <http://example.org/o> }',
        contentType: 'application/sparql-update',
        transaction: {
          transactionUrl,
          action: 'UPDATE'
        }
      })

      expect(global.fetch).toHaveBeenCalledWith(
        `${transactionUrl}?action=UPDATE`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/sparql-update'
          }),
          body: 'UPDATE DATA { <http://example.org/s> <http://example.org/p> <http://example.org/o> }'
        })
      )
    })

    test('should handle transaction commit', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      const transactionUrl = 'http://test-server.com/rdf4j-server/repositories/kms/transactions/123'
      await sparqlRequest({
        method: 'PUT',
        transaction: {
          transactionUrl,
          action: 'COMMIT'
        }
      })

      expect(global.fetch).toHaveBeenCalledWith(
        `${transactionUrl}?action=COMMIT`,
        expect.objectContaining({
          method: 'PUT'
        })
      )
    })

    test('should handle transaction rollback', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({})
      }
      global.fetch.mockResolvedValue(mockResponse)

      const transactionUrl = 'http://test-server.com/rdf4j-server/repositories/kms/transactions/123'
      await sparqlRequest({
        method: 'DELETE',
        transaction: {
          transactionUrl
        }
      })

      expect(global.fetch).toHaveBeenCalledWith(
        transactionUrl,
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })
  })

  describe('when unsuccessful', () => {
    test('should throw an error if fetch fails', async () => {
      process.env.SPARQL_COLD_MAX_RETRIES = '0'
      global.fetch.mockRejectedValue(new Error('Network error'))

      await expect(sparqlRequest({ method: 'GET' })).rejects.toThrow('Network error')
    })

    test('should clear timeout when request fails with timeout enabled', async () => {
      process.env.SPARQL_COLD_MAX_RETRIES = '0'
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      global.fetch.mockRejectedValue(new Error('Network error'))

      await expect(sparqlRequest({
        method: 'GET',
        timeoutMs: 5
      })).rejects.toThrow('Network error')

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    test('should throw an error if response is not OK', async () => {
      const errorResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid SPARQL query')
      }
      global.fetch.mockResolvedValue(errorResponse)

      await expect(sparqlRequest({
        method: 'POST',
        body: 'INVALID QUERY',
        contentType: 'application/sparql-query'
      })).rejects.toThrow('HTTP error! status: 400, body: Invalid SPARQL query')

      expect(global.fetch).toHaveBeenCalledTimes(2) // Initial + 1 cold retry by default
    })

    describe('when retrying', () => {
      test('should handle retrying by fetching multiple times', async () => {
        process.env.SPARQL_COLD_MAX_RETRIES = '2'
        global.fetch
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({})
          })

        await expect(sparqlRequest({ method: 'GET' })).resolves.toBeDefined()

        expect(global.fetch).toHaveBeenCalledTimes(3)
        expect(delay).toHaveBeenCalledTimes(2)
        expect(delay).toHaveBeenCalledWith(1000) // RETRY_DELAY value
      })

      test('should retry using cold adaptive retry count and then throw an error', async () => {
        process.env.SPARQL_COLD_MAX_RETRIES = '10'
        global.fetch.mockRejectedValue(new Error('Persistent network error'))

        await expect(sparqlRequest({ method: 'GET' })).rejects.toThrow('Persistent network error')

        expect(global.fetch).toHaveBeenCalledTimes(11) // Initial attempt + cold retries (10)
        expect(delay).toHaveBeenCalledTimes(10) // Called for each retry
        expect(delay).toHaveBeenCalledWith(1000) // RETRY_DELAY value
      })

      test('should use cold adaptive retry policy before any successful request', async () => {
        process.env.SPARQL_WARM_WINDOW_MS = '60000'
        process.env.SPARQL_WARM_MAX_RETRIES = '0'
        process.env.SPARQL_COLD_MAX_RETRIES = '1'
        global.fetch.mockRejectedValue(new Error('Cold error'))

        await expect(sparqlRequest({
          method: 'GET'
        })).rejects.toThrow('Cold error')

        expect(global.fetch).toHaveBeenCalledTimes(2) // Initial + 1 cold retry
      })

      test('should use warm adaptive retry policy after a successful request', async () => {
        process.env.SPARQL_WARM_WINDOW_MS = '60000'
        process.env.SPARQL_WARM_MAX_RETRIES = '0'
        process.env.SPARQL_COLD_MAX_RETRIES = '1'
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })

        await sparqlRequest({
          method: 'GET'
        })

        global.fetch.mockRejectedValue(new Error('Warm error'))
        await expect(sparqlRequest({
          method: 'GET'
        })).rejects.toThrow('Warm error')

        // 1 successful call, then one failed warm call with no retry.
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })
  })
})
