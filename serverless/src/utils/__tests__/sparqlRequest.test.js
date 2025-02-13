import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach
} from 'vitest'
import { sparqlRequest } from '../sparqlRequest'

// Mock fetch globally
global.fetch = vi.fn()

describe('sparqlRequest', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Set up environment variables
    process.env.RDF4J_SERVICE_URL = 'http://test-server.com'
    process.env.RDF4J_USER_NAME = 'testuser'
    process.env.RDF4J_PASSWORD = 'testpass'
  })

  afterEach(() => {
    // Clear environment variables after each test
    delete process.env.RDF4J_SERVICE_URL
    delete process.env.RDF4J_USER_NAME
    delete process.env.RDF4J_PASSWORD
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
      accept: 'application/sparql-results+json'
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

    await sparqlRequest({ method: 'GET' })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/rdf+xml',
          Accept: 'application/rdf+xml'
        })
      })
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

  test('should throw an error if fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'))

    await expect(sparqlRequest({ method: 'GET' })).rejects.toThrow('Network error')
  })
})
