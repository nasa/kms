import { getApplicationConfig } from '../../../../sharedUtils/getConfig'
import status from '../handler'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RDF4J_SERVICE_URL = 'http://localhost:8080'
})

describe('status', () => {
  test('returns a 200 status code', async () => {
    const { defaultResponseHeaders } = getApplicationConfig()

    // Mock a successful fetch response
    global.fetch = vi.fn(() => Promise.resolve({
      headers: defaultResponseHeaders,
      ok: true,
      status: 200,
      text: () => Promise.resolve('13')
    }))

    const result = await status()

    expect(result.statusCode).toBe(200)
    expect(result.headers['Content-Type']).toBe('text/plain')
    expect(result.body).toBe('Database connection healthy')
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/rdf4j-server/protocol',
      expect.objectContaining({
        headers: expect.any(Object)
      })
    )
  })
})
