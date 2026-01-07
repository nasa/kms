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

    // Mock the logger
    vi.spyOn(logger, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
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

    expect(logger.info).toHaveBeenCalledWith(
      'URL:',
      expectedUrl,
      'with options:',
      expectedOptions
    )
  })
})
