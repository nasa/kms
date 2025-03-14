import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrRequest } from '../cmrRequest'

describe('cmrRequest', () => {
  beforeEach(() => {
    // Mock the fetch function
    global.fetch = vi.fn()

    // Mock process.env
    process.env.CMR_BASE_URL = 'https://cmr.example.com'
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  test('should make a request with default options', async () => {
    global.fetch.mockResolvedValueOnce('mock response')

    const result = await cmrRequest({ method: 'GET' })

    expect(global.fetch).toHaveBeenCalledWith('https://cmr.example.com', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    })

    expect(result).toBe('mock response')
  })

  test('should make a request with custom options', async () => {
    global.fetch.mockResolvedValueOnce('mock response')

    const result = await cmrRequest({
      path: '/api/collections',
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
      contentType: 'application/xml',
      accept: 'application/xml'
    })

    expect(global.fetch).toHaveBeenCalledWith('https://cmr.example.com/api/collections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        Accept: 'application/xml'
      },
      body: JSON.stringify({ key: 'value' })
    })

    expect(result).toBe('mock response')
  })

  test('should not include body in fetchOptions if it is empty', async () => {
    global.fetch.mockResolvedValueOnce('mock response')

    await cmrRequest({
      method: 'GET',
      body: ''
    })

    expect(global.fetch).toHaveBeenCalledWith('https://cmr.example.com', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    })
  })

  test('should use the CMR_BASE_URL from environment variables', async () => {
    process.env.CMR_BASE_URL = 'https://custom.cmr.com'
    global.fetch.mockResolvedValueOnce('mock response')

    await cmrRequest({ method: 'GET' })

    expect(global.fetch).toHaveBeenCalledWith('https://custom.cmr.com', expect.any(Object))
  })
})
