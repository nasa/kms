import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrGetRequest } from '../cmrGetRequest'

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
})
