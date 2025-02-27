import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'

import { status } from '../handler'

// Mock the getApplicationConfig function
vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn()
}))

const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RDFDB_BASE_URL = 'http://localhost:8080'

  // Mock the getApplicationConfig function
  getApplicationConfig.mockReturnValue({
    defaultResponseHeaders: { 'Access-Control-Allow-Origin': '*' },
    sparqlHealthCheckPath: '/healthcheck-endpoint'
  })
})

describe('status', () => {
  beforeAll(() => {
    console.log = vi.fn()
    console.error = vi.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  describe('perform status check', () => {
    describe('if database is healthy', () => {
      test('returns a 200 status code', async () => {
        // Mock a successful fetch response
        global.fetch = vi.fn(() => Promise.resolve({
          ok: true,
          status: 200
        }))

        const result = await status()

        expect(result.statusCode).toBe(200)
        expect(result.headers['Content-Type']).toBe('text/plain')
        expect(result.body).toBe('Database connection healthy')
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:8080/healthcheck-endpoint'
        )
      })
    })

    describe('if database is not healthy', () => {
      test('returns a 500 with status message', async () => {
        global.fetch = vi.fn(() => Promise.resolve({
          ok: false,
          status: 500
        }))

        const result = await status()

        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body)).toEqual({ error: 'Failed to fetch RDFDB status' })
      })
    })

    describe('if network failure', () => {
      test('returns a 500 with error message', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

        const result = await status()

        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body)).toEqual({ error: 'Failed to fetch RDFDB status' })
      })
    })
  })
})
