import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import * as getConfigModule from '@/shared/getConfig'
import * as getVersionNamesModule from '@/shared/getVersionNames'

import { status } from '../handler'

vi.mock('@/shared/getConfig')
vi.mock('@/shared/getVersionNames')

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

      getVersionNamesModule.getVersionNames.mockResolvedValue(['v1.0', 'v2.0', 'v3.0'])
    })

    test('should return a 200 status code and healthy message', async () => {
      const result = await status()

      expect(result.statusCode).toBe(200)
      expect(result.body).toBe('Database connection healthy.  3 versions retrieved.')
      expect(result.headers['Content-Type']).toBe('text/plain')
      expect(result.headers['X-Test']).toBe('test-header')
    })

    test('should call fetch with the correct URL', async () => {
      await status()

      expect(global.fetch).toHaveBeenCalledWith('http://test-rdf4j-server.com/rdf4j-server/protocol')
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

    test('should return a 500 status code when getVersionNames fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      })

      getVersionNamesModule.getVersionNames.mockRejectedValue(new Error('Failed to get versions'))

      const result = await status()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to fetch RDF4J status')
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
