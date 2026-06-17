import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrPutRequest } from '../cmrPutRequest'
import { logger } from '../logger'

describe('cmrPutRequest', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    process.env.CMR_BASE_URL = 'https://cmr-test.earthdata.nasa.gov'

    vi.spyOn(logger, 'debug').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    delete process.env.CMR_BASE_URL
    vi.restoreAllMocks()
  })

  test('should throw when CMR_BASE_URL is not configured', async () => {
    delete process.env.CMR_BASE_URL

    await expect(cmrPutRequest({
      path: '/ingest/providers/KMS/collections/native-1'
    })).rejects.toThrow('CMR_BASE_URL environment variable is not set')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('should make a PUT request with correct parameters', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    })

    const path = '/ingest/providers/KMS/collections/native-1'
    const body = '<DIF><Entry_ID/></DIF>'

    await cmrPutRequest({
      path,
      body,
      contentType: 'application/dif10+xml'
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/dif10+xml',
          Accept: 'application/json'
        },
        body
      }
    )
  })

  test('should not include body in request if it is empty', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    })

    await cmrPutRequest({
      path: '/ingest/providers/KMS/collections/native-1'
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    )
  })

  test('should use custom accept and merge custom headers', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    })

    await cmrPutRequest({
      path: '/ingest/providers/KMS/collections/native-1',
      body: '{}',
      accept: 'application/vnd.nasa.cmr.umm+json',
      headers: {
        Authorization: 'Bearer token'
      }
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/vnd.nasa.cmr.umm+json',
          Authorization: 'Bearer token'
        },
        body: '{}'
      }
    )
  })

  test('should log the correct URL and options', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    })

    const path = '/ingest/providers/KMS/collections/native-1'
    const body = '{}'

    await cmrPutRequest({
      path,
      body
    })

    expect(logger.debug).toHaveBeenCalledWith(
      'URL:',
      'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1',
      'with options:',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body
      }
    )
  })

  test('should log request context when fetch fails', async () => {
    const error = new TypeError('fetch failed')

    error.cause = {
      code: 'ENOTFOUND',
      errno: -3008,
      syscall: 'getaddrinfo',
      address: undefined,
      port: undefined,
      message: 'getaddrinfo ENOTFOUND internal-cmr',
      name: 'Error'
    }

    global.fetch.mockRejectedValueOnce(error)

    await expect(cmrPutRequest({
      path: '/ingest/providers/KMS/collections/native-1',
      body: '{}'
    })).rejects.toThrow('fetch failed')

    expect(logger.error).toHaveBeenCalledWith('[cmr-put] CMR write failed', {
      method: 'PUT',
      endpoint: 'https://cmr-test.earthdata.nasa.gov',
      path: '/ingest/providers/KMS/collections/native-1',
      fullUrl: 'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1',
      bodyLength: 2,
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
        message: 'getaddrinfo ENOTFOUND internal-cmr',
        code: 'ENOTFOUND',
        errno: -3008,
        syscall: 'getaddrinfo',
        address: undefined,
        port: undefined
      }
    })
  })

  test('should attach request context when fetch fails without a cause object', async () => {
    const error = new Error('plain fetch failure')

    global.fetch.mockRejectedValueOnce(error)

    await expect(cmrPutRequest({
      path: '/ingest/providers/KMS/collections/native-1',
      body: '{}'
    })).rejects.toThrow('plain fetch failure')

    expect(error.cmrRequest).toEqual({
      method: 'PUT',
      endpoint: 'https://cmr-test.earthdata.nasa.gov',
      path: '/ingest/providers/KMS/collections/native-1',
      fullUrl: 'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1',
      bodyLength: 2
    })

    expect(error.cmrCause).toBeUndefined()
  })

  test('should rethrow non-object fetch failures without attaching request metadata', async () => {
    global.fetch.mockRejectedValueOnce('literal failure')

    await expect(cmrPutRequest({
      path: '/ingest/providers/KMS/collections/native-1',
      body: '{}'
    })).rejects.toBe('literal failure')
  })

  test('should record an undefined bodyLength for failed requests with non-string bodies', async () => {
    const error = new Error('object body failure')

    global.fetch.mockRejectedValueOnce(error)

    await expect(cmrPutRequest({
      path: '/ingest/providers/KMS/collections/native-1',
      body: {
        test: true
      }
    })).rejects.toThrow('object body failure')

    expect(error.cmrRequest).toEqual({
      method: 'PUT',
      endpoint: 'https://cmr-test.earthdata.nasa.gov',
      path: '/ingest/providers/KMS/collections/native-1',
      fullUrl: 'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1',
      bodyLength: undefined
    })
  })
})
