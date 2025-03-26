import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { recreateDatabase } from '../handler'

// Mock the getApplicationConfig function
vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: { 'Content-Type': 'application/json' }
  }))
}))

// Mock the global fetch function
global.fetch = vi.fn()

describe('recreateDatabase', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.RDF4J_SERVICE_URL = 'http://test-rdf4j-service'
    process.env.RDF4J_USER_NAME = 'testuser'
    process.env.RDF4J_PASSWORD = 'testpass'

    process.env.RDF4J_SERVICE_URL = 'http://test-rdf4j-service'
  })

  describe('when succesful', () => {
    test('should successfully recreate the database', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })

      const result = await recreateDatabase()

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toContain('Successfully recreated repository')
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    test('should handle non-existent repository during deletion', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        })
        .mockResolvedValueOnce({ ok: true })

      const result = await recreateDatabase()

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).message).toContain('Successfully recreated repository')
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('when unsuccesful', () => {
    test('should handle failure to delete repository', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      const result = await recreateDatabase()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to recreate database')
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    test('should handle failure to create repository', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })

      const result = await recreateDatabase()

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).error).toBe('Failed to recreate database')
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Authentication', () => {
    test('should use correct authorization header', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })

      await recreateDatabase()

      const expectedAuthHeader = `Basic ${Buffer.from('testuser:testpass').toString('base64')}`
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expectedAuthHeader
          })
        })
      )
    })
  })
})
