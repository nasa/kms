import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrGetRequest } from '../cmrGetRequest'
import { logger } from '../logger'

describe('cmrGetRequest', () => {
  beforeEach(() => {
    // Mock the process.env
    vi.stubGlobal('process', {
      env: {
        CMR_BASE_URL: 'https://cmr.example.com'
      }
    })

    // Mock the global fetch function
    global.fetch = vi.fn()

    // Mock the logger
    vi.spyOn(logger, 'debug').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  test('should make a GET request to the correct URL', async () => {
    const path = '/search'
    const expectedUrl = 'https://cmr.example.com/search'

    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({ path })

    expect(global.fetch).toHaveBeenCalledWith(expectedUrl, { method: 'GET' })
  })

  test('should use the correct base URL from environment variable', async () => {
    const path = '/collections'
    const expectedUrl = 'https://cmr.example.com/collections'

    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({ path })

    expect(global.fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
  })

  test('should return the fetch response', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    }
    global.fetch.mockResolvedValueOnce(mockResponse)

    const result = await cmrGetRequest({ path: '/test' })

    expect(result).toBe(mockResponse)
  })

  test('should throw an error if fetch fails', async () => {
    const error = new Error('Network error')
    global.fetch.mockRejectedValueOnce(error)

    await expect(cmrGetRequest({ path: '/test' })).rejects.toThrow('Network error')
  })

  test('should log request context when fetch fails', async () => {
    const error = new TypeError('fetch failed')

    error.cause = {
      code: 'ECONNREFUSED',
      errno: -61,
      syscall: 'connect',
      address: '127.0.0.1',
      port: 8080,
      message: 'connect ECONNREFUSED 127.0.0.1:8080',
      name: 'Error'
    }

    global.fetch.mockRejectedValueOnce(error)

    await expect(cmrGetRequest({ path: '/test' })).rejects.toThrow('fetch failed')

    expect(logger.error).toHaveBeenCalledWith('[cmr-get] CMR fetch failed', {
      method: 'GET',
      baseUrlSource: 'CMR_BASE_URL',
      endpoint: 'https://cmr.example.com',
      path: '/test',
      fullUrl: 'https://cmr.example.com/test',
      error: {
        name: 'TypeError',
        message: 'fetch failed',
        code: undefined,
        errno: undefined,
        syscall: undefined,
        address: undefined,
        port: undefined
      },
      cause: {
        name: 'Error',
        message: 'connect ECONNREFUSED 127.0.0.1:8080',
        code: 'ECONNREFUSED',
        errno: -61,
        syscall: 'connect',
        address: '127.0.0.1',
        port: 8080
      }
    })
  })

  test('should log the correct URL and options', async () => {
    const path = '/search'
    const expectedUrl = 'https://cmr.example.com/search'
    const expectedOptions = { method: 'GET' }

    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({ path })

    expect(logger.debug).toHaveBeenCalledWith(
      'URL:',
      expectedUrl,
      'with options:',
      expectedOptions
    )
  })

  test('should include custom accept and headers when provided', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({
      path: '/collections',
      accept: 'application/json',
      headers: {
        'X-Request-Id': 'request-123'
      }
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr.example.com/collections',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Request-Id': 'request-123'
        }
      }
    )
  })

  test('should prefer CMR_LB_URL when it is configured', async () => {
    process.env.CMR_LB_URL = 'http://internal-cmr.example.local'

    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({
      path: '/collections'
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://internal-cmr.example.local/collections',
      {
        method: 'GET'
      }
    )

    expect(logger.info).toHaveBeenCalledWith('[cmr-get] Sending CMR request', {
      method: 'GET',
      baseUrlSource: 'CMR_LB_URL',
      endpoint: 'http://internal-cmr.example.local',
      path: '/collections',
      fullUrl: 'http://internal-cmr.example.local/collections'
    })
  })
})
