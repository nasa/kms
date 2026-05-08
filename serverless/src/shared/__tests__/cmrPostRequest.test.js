import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrPostRequest } from '../cmrPostRequest'
import { logger } from '../logger'

describe('cmrPostRequest', () => {
  beforeEach(() => {
    // Mock the fetch function
    global.fetch = vi.fn()

    // Mock process.env
    process.env.CMR_BASE_URL = 'https://cmr-test.earthdata.nasa.gov'
    delete process.env.CMR_LB_URL

    // Mock the logger
    vi.spyOn(logger, 'debug').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    delete process.env.CMR_LB_URL
    vi.restoreAllMocks()
  })

  test('should make a POST request with correct parameters', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    }
    global.fetch.mockResolvedValue(mockResponse)

    const path = '/search/collections.json'
    const body = JSON.stringify({ query: 'some query' })

    await cmrPostRequest({
      path,
      body
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr-test.earthdata.nasa.gov/search/collections.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body
      }
    )
  })

  test('should not include body in request if it is empty', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    }
    global.fetch.mockResolvedValue(mockResponse)

    const path = '/search/collections.json'

    await cmrPostRequest({ path })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr-test.earthdata.nasa.gov/search/collections.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    )
  })

  test('should use custom content type and accept headers if provided', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    }
    global.fetch.mockResolvedValue(mockResponse)

    const path = '/search/collections.json'
    const body = '<some-xml-data/>'
    const contentType = 'application/xml'
    const accept = 'application/xml'

    await cmrPostRequest({
      path,
      body,
      contentType,
      accept
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr-test.earthdata.nasa.gov/search/collections.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml'
        },
        body
      }
    )
  })

  test('should log the correct URL and options', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    }
    global.fetch.mockResolvedValue(mockResponse)

    const path = '/search/collections.json'
    const body = JSON.stringify({ query: 'some query' })

    await cmrPostRequest({
      path,
      body
    })

    const expectedUrl = 'https://cmr-test.earthdata.nasa.gov/search/collections.json'
    const expectedOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body
    }

    expect(logger.debug).toHaveBeenCalledWith(
      'URL:',
      expectedUrl,
      'with options:',
      expectedOptions
    )
  })

  test('should merge custom headers when provided', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    })

    await cmrPostRequest({
      path: '/search/collections.json',
      headers: {
        'Cmr-Validate-Keywords': 'true'
      }
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://cmr-test.earthdata.nasa.gov/search/collections.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cmr-Validate-Keywords': 'true'
        }
      }
    )
  })

  test('should prefer CMR_LB_URL when it is configured', async () => {
    process.env.CMR_LB_URL = 'http://internal-cmr.example.local'

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' })
    })

    await cmrPostRequest({
      path: '/search/collections.json'
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://internal-cmr.example.local/search/collections.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    )

    expect(logger.info).toHaveBeenCalledWith('[cmr-post] Sending CMR request', {
      method: 'POST',
      baseUrlSource: 'CMR_LB_URL',
      endpoint: 'http://internal-cmr.example.local',
      path: '/search/collections.json',
      fullUrl: 'http://internal-cmr.example.local/search/collections.json',
      bodyLength: undefined
    })
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

    await expect(cmrPostRequest({
      path: '/search/collections.json',
      body: JSON.stringify({
        query: 'some query'
      })
    })).rejects.toThrow('fetch failed')

    expect(logger.error).toHaveBeenCalledWith('[cmr-post] CMR fetch failed', {
      method: 'POST',
      baseUrlSource: 'CMR_BASE_URL',
      endpoint: 'https://cmr-test.earthdata.nasa.gov',
      path: '/search/collections.json',
      fullUrl: 'https://cmr-test.earthdata.nasa.gov/search/collections.json',
      bodyLength: 22,
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
})
