// CmrRequest.test.js

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrGetRequest, cmrPostRequest } from '../cmrRequest'

// Mock the global fetch function
global.fetch = vi.fn()

describe('cmrRequest', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    // Set up the environment variable
    process.env.CMR_BASE_URL = 'https://cmr.example.com'
  })

  afterEach(() => {
    // Clear environment variables after each test
    delete process.env.CMR_BASE_URL
  })

  describe('cmrPostRequest', () => {
    it('should make a POST request with correct parameters', async () => {
      // Mock the fetch response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      })

      const result = await cmrPostRequest({
        path: '/search/collections',
        body: JSON.stringify({ query: { keyword: 'MODIS' } }),
        contentType: 'application/json',
        accept: 'application/json'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://cmr.example.com/search/collections',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ query: { keyword: 'MODIS' } })
        }
      )

      const jsonResult = await result.json()
      expect(jsonResult).toEqual({ success: true })
    })

    it('should not include body in request if it is empty', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
      })

      await cmrPostRequest({
        path: '/search/collections'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://cmr.example.com/search/collections',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        }
      )
    })
  })

  describe('cmrGetRequest', () => {
    it('should make a GET request with correct parameters', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      })

      const result = await cmrGetRequest({
        path: '/search/collections?keyword=MODIS'
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'https://cmr.example.com/search/collections?keyword=MODIS',
        {
          method: 'GET'
        }
      )

      const jsonResult = await result.json()
      expect(jsonResult).toEqual({ success: true })
    })
  })
})
