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
    vi.stubEnv('CMR_BASE_URL', 'https://cmr.example.com')
    vi.stubEnv('CMR_GET_TIMEOUT_MS', '')

    // Mock the global fetch function
    vi.stubGlobal('fetch', vi.fn())

    // Mock the logger
    vi.spyOn(logger, 'debug').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('should make a GET request to the correct URL', async () => {
    const path = '/search'
    const expectedUrl = 'https://cmr.example.com/search'

    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({ path })

    expect(global.fetch).toHaveBeenCalledWith(expectedUrl, {
      method: 'GET',
      signal: expect.any(AbortSignal)
    })
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

  test('should rethrow non-object fetch failures without attaching request context', async () => {
    global.fetch.mockRejectedValueOnce('Network error')

    await expect(cmrGetRequest({ path: '/test' })).rejects.toBe('Network error')
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
      endpoint: 'https://cmr.example.com',
      path: '/test',
      fullUrl: 'https://cmr.example.com/test',
      timeoutMs: 25000,
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
        signal: expect.any(AbortSignal),
        headers: {
          Accept: 'application/json',
          'X-Request-Id': 'request-123'
        }
      }
    )

    expect(logger.debug).toHaveBeenCalledWith(
      'URL:',
      'https://cmr.example.com/collections',
      'with options:',
      {
        method: 'GET',
        headerNames: ['Accept', 'X-Request-Id']
      }
    )

    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('request-123')
  })

  test('should throw when CMR_BASE_URL is not configured', async () => {
    delete process.env.CMR_BASE_URL

    await expect(cmrGetRequest({
      path: '/collections'
    })).rejects.toThrow('CMR_BASE_URL environment variable is not set')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('should default to a 25-second request timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({ path: '/test' })

    expect(timeout).toHaveBeenCalledWith(25000)
  })

  test('should use the configured request timeout', async () => {
    process.env.CMR_GET_TIMEOUT_MS = '12000'
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    global.fetch.mockResolvedValueOnce({ ok: true })

    await cmrGetRequest({ path: '/test' })

    expect(timeout).toHaveBeenCalledWith(12000)
  })

  test.each(['invalid', '0', '-1', '1.5', 'Infinity', '2147483648'])(
    'should use the default timeout for invalid configuration %s',
    async (configuredTimeout) => {
      process.env.CMR_GET_TIMEOUT_MS = configuredTimeout
      const timeout = vi.spyOn(AbortSignal, 'timeout')
      global.fetch.mockResolvedValueOnce({ ok: true })

      await cmrGetRequest({ path: '/test' })

      expect(timeout).toHaveBeenCalledWith(25000)
    }
  )

  describe('when the request timeout signal aborts', () => {
    let controller

    beforeEach(() => {
      // Control the timeout signal without starting a server or waiting for a real timer.
      controller = new AbortController()
      vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
      vi.stubEnv('CMR_GET_TIMEOUT_MS', '500')
    })

    test('should abort a stalled GET and log its timeout without retrying', async () => {
      global.fetch.mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      }))

      const request = cmrGetRequest({ path: '/headers' })
      const rejection = expect(request).rejects.toMatchObject({
        name: 'TimeoutError',
        cmrRequest: expect.objectContaining({
          path: '/headers',
          timeoutMs: 500
        })
      })

      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
      await rejection

      expect(AbortSignal.timeout).toHaveBeenCalledWith(500)
      expect(global.fetch.mock.calls[0][1].signal).toBe(controller.signal)
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith(
        '[cmr-get] CMR fetch failed',
        expect.objectContaining({
          timeoutMs: 500,
          error: expect.objectContaining({ name: 'TimeoutError' })
        })
      )
    })

    test('should keep the timeout signal available for body consumption after fetch resolves', async () => {
      global.fetch.mockImplementationOnce(async (url, { signal }) => ({
        ok: true,
        text: vi.fn(async () => {
          signal.throwIfAborted()

          return 'body'
        })
      }))

      const response = await cmrGetRequest({ path: '/body' })

      expect(response.ok).toBe(true)
      expect(global.fetch.mock.calls[0][1].signal).toBe(controller.signal)
      expect(controller.signal.aborted).toBe(false)

      controller.abort(new DOMException('Request timed out', 'TimeoutError'))

      await expect(response.text()).rejects.toBe(controller.signal.reason)
      expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})
