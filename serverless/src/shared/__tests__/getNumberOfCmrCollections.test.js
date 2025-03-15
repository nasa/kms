import {
  afterEach,
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { cmrRequest } from '../cmrRequest'
import { getNumberOfCmrCollections } from '../getNumberOfCmrCollections'

// Mock the cmrRequest function
vi.mock('../cmrRequest', () => ({
  cmrRequest: vi.fn()
}))

describe('getNumberOfCmrCollections', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore all mocks after each test
    vi.restoreAllMocks()
  })

  describe('When successful', () => {
    test('should return the correct number of collections for science keywords', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '42']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'sciencekeywords',
        conceptId: '1234-5678-9ABC-DEF0'
      })

      expect(result).toBe(42)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections',
        method: 'POST',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          condition: {
            science_keywords: {
              uuid: '1234-5678-9ABC-DEF0'
            }
          }
        })
      })
    })

    test('should return the correct number of collections for projects', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '15']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'projects',
        prefLabel: 'CALIPSO'
      })

      expect(result).toBe(15)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections',
        method: 'POST',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          condition: {
            project: 'CALIPSO'
          }
        })
      })
    })

    test('should handle platforms scheme', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '10']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'platforms',
        conceptId: 'PLATFORM-UUID-1234'
      })

      expect(result).toBe(10)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections',
        method: 'POST',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          condition: {
            platform: {
              uuid: 'PLATFORM-UUID-1234'
            }
          }
        })
      })
    })

    test('should handle instruments scheme', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '5']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'instruments',
        conceptId: 'INSTRUMENT-UUID-5678'
      })

      expect(result).toBe(5)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections',
        method: 'POST',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          condition: {
            instrument: {
              uuid: 'INSTRUMENT-UUID-5678'
            }
          }
        })
      })
    })

    test('should handle locations scheme', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '8']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'locations',
        conceptId: 'LOCATION-UUID-9012'
      })

      expect(result).toBe(8)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections',
        method: 'POST',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          condition: {
            location_keyword: {
              uuid: 'LOCATION-UUID-9012'
            }
          }
        })
      })
    })

    test('should return the correct number of collections for custom schemes', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '3']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'custom_scheme',
        prefLabel: 'custom_value'
      })

      expect(result).toBe(3)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections?custom_scheme=custom_value',
        method: 'GET',
        contentType: 'application/json',
        accept: 'application/json',
        body: null
      })
    })
  })

  describe('When unsuccessful', () => {
    test('should return null when a network error occurs', async () => {
      cmrRequest.mockRejectedValue(new Error('Network error'))

      const result = await getNumberOfCmrCollections({
        scheme: 'sciencekeywords',
        conceptId: '1234-5678-9ABC-DEF0'
      })

      expect(result).toBeNull()
    })

    test('should return null when an HTTP error occurs', async () => {
      cmrRequest.mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'sciencekeywords',
        conceptId: '1234-5678-9ABC-DEF0'
      })

      expect(result).toBeNull()
    })

    test('should return null when cmr-hits header is missing', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map()
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'sciencekeywords',
        conceptId: '1234-5678-9ABC-DEF0'
      })

      expect(result).toBe(0)
    })

    test('should return null when cmr-hits header is not a number', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', 'not a number']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'sciencekeywords',
        conceptId: '1234-5678-9ABC-DEF0'
      })

      expect(result).toBe(0)
    })
  })

  describe('Edge cases', () => {
    test('should handle uppercase scheme names', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '5']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'SCIENCEKEYWORDS',
        conceptId: '1234-5678-9ABC-DEF0'
      })

      expect(result).toBe(5)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections',
        method: 'POST',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          condition: {
            science_keywords: {
              uuid: '1234-5678-9ABC-DEF0'
            }
          }
        })
      })
    })

    test('should handle unknown schemes', async () => {
      cmrRequest.mockResolvedValue({
        ok: true,
        headers: new Map([['cmr-hits', '2']])
      })

      const result = await getNumberOfCmrCollections({
        scheme: 'unknown_scheme',
        prefLabel: 'test_value'
      })

      expect(result).toBe(2)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections?unknown_scheme=test_value',
        method: 'GET',
        contentType: 'application/json',
        accept: 'application/json',
        body: null
      })
    })

    test('should handle errors for ProductLevelId scheme and return null', async () => {
      const testError = new Error('Test error')
      cmrRequest.mockRejectedValue(testError)

      const consoleErrorSpy = vi.spyOn(console, 'error')

      const result = await getNumberOfCmrCollections({
        scheme: 'ProductLevelId',
        prefLabel: '2'
      })

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getNumberOfCmrCollections:', testError)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections',
        method: 'POST',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          condition: {
            ProductLevelId: '2'
          }
        })
      })
    })

    test('should handle errors for custom schemes and return null', async () => {
      const testError = new Error('Test error')
      cmrRequest.mockRejectedValue(testError)

      const consoleErrorSpy = vi.spyOn(console, 'error')

      const result = await getNumberOfCmrCollections({
        scheme: 'custom_scheme',
        prefLabel: 'custom_value'
      })

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in getNumberOfCmrCollections:', testError)
      expect(cmrRequest).toHaveBeenCalledWith({
        path: '/search/collections?custom_scheme=custom_value',
        method: 'GET',
        contentType: 'application/json',
        accept: 'application/json',
        body: null
      })
    })
  })
})
