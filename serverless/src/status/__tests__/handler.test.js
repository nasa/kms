import { describe } from 'vitest'
import status from '../handler'

const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RDF4J_SERVICE_URL = 'http://localhost:8080'
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
      it('returns a 200 status code', async () => {
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
          'http://localhost:8080/rdf4j-server/protocol'
        )
      })
    })

    describe('if database is not healthy', () => {
      it('returns a 500 with status message', async () => {
        global.fetch = vi.fn(() => Promise.resolve({
          ok: false,
          status: 500
        }))

        const result = await status()

        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body)).toEqual({ error: 'Failed to fetch RDF4J status' })
      })
    })

    describe('if network failure', () => {
      it('returns a 500 with error message', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))

        const result = await status()

        expect(result.statusCode).toBe(500)
        expect(JSON.parse(result.body)).toEqual({ error: 'Failed to fetch RDF4J status' })
      })
    })
  })
})
