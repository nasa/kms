import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { BaseConceptCacheBuilder } from '../baseConceptCacheBuilder'
import { setCachedJsonResponse } from '../redisCacheStore'

vi.mock('../redisCacheStore', () => ({
  setCachedJsonResponse: vi.fn(() => Promise.resolve())
}))

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

// Create a concrete implementation for testing
class TestCacheBuilder extends BaseConceptCacheBuilder {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  parseCsvContent(csvContent) {
    // Simple implementation for testing
    return new Map([
      ['key1', 'value1'],
      ['key2', 'value2']
    ])
  }

  createCacheKey(key, scheme) {
    return `test:${scheme}:${key}`
  }

  createResponseBody(key, value) {
    return {
      key,
      value
    }
  }
}

describe('BaseConceptCacheBuilder', () => {
  let builder

  beforeEach(() => {
    builder = new TestCacheBuilder()
    vi.clearAllMocks()
  })

  describe('parseCSV', () => {
    it('should parse CSV content with correct configuration', () => {
      const csvContent = '"header1","header2"\n"value1","value2"'
      const result = builder.parseCSV(csvContent)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(['header1', 'header2'])
      expect(result[1]).toEqual(['value1', 'value2'])
    })
  })

  describe('createResponse', () => {
    it('should create a standardized response object', () => {
      const bodyData = {
        uuid: '123',
        fullPath: 'A > B'
      }
      const response = builder.createResponse(bodyData)

      expect(response).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      })
    })
  })

  describe('cacheRecord', () => {
    it('should cache a record successfully', async () => {
      const cacheKey = 'test:key'
      const response = {
        statusCode: 200,
        body: '{}'
      }
      const identifier = 'test-id'

      await builder.cacheRecord(cacheKey, response, identifier)

      expect(setCachedJsonResponse).toHaveBeenCalledWith({
        cacheKey,
        response
      })
    })

    it('should handle caching errors gracefully', async () => {
      const error = new Error('Cache write failed')
      vi.mocked(setCachedJsonResponse).mockRejectedValueOnce(error)

      const cacheKey = 'test:key'
      const response = {
        statusCode: 200,
        body: '{}'
      }
      const identifier = 'test-id'

      // Should not throw
      await expect(
        builder.cacheRecord(cacheKey, response, identifier)
      ).resolves.toBeUndefined()
    })
  })

  describe('processToCache', () => {
    it('should process all records and cache them', async () => {
      await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(setCachedJsonResponse).toHaveBeenCalledTimes(2)
      expect(setCachedJsonResponse).toHaveBeenCalledWith({
        cacheKey: 'test:test-scheme:key1',
        response: {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'key1',
            value: 'value1'
          })
        }
      })

      expect(setCachedJsonResponse).toHaveBeenCalledWith({
        cacheKey: 'test:test-scheme:key2',
        response: {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'key2',
            value: 'value2'
          })
        }
      })
    })

    it('should skip records that fail shouldCache validation', async () => {
      // Override shouldCache to reject key2
      builder.shouldCache = (key) => key !== 'key2'

      await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(setCachedJsonResponse).toHaveBeenCalledTimes(1)
      expect(setCachedJsonResponse).toHaveBeenCalledWith({
        cacheKey: 'test:test-scheme:key1',
        response: expect.any(Object)
      })
    })
  })

  describe('shouldCache', () => {
    it('should return true for valid key and value', () => {
      expect(builder.shouldCache('key', 'value')).toBe(true)
    })

    it('should return false for falsy key', () => {
      expect(builder.shouldCache('', 'value')).toBe(false)
      expect(builder.shouldCache(null, 'value')).toBe(false)
    })

    it('should return false for falsy value', () => {
      expect(builder.shouldCache('key', '')).toBe(false)
      expect(builder.shouldCache('key', null)).toBe(false)
    })
  })

  describe('getIdentifier', () => {
    it('should return the key as identifier', () => {
      expect(builder.getIdentifier('test-key')).toBe('test-key')
    })
  })

  describe('abstract methods', () => {
    it('should throw error if parseCsvContent is not implemented', () => {
      const baseBuilder = new BaseConceptCacheBuilder()
      expect(() => baseBuilder.parseCsvContent('content')).toThrow(
        'parseCsvContent must be implemented by subclass'
      )
    })

    it('should throw error if createCacheKey is not implemented', () => {
      const baseBuilder = new BaseConceptCacheBuilder()
      expect(() => baseBuilder.createCacheKey('key', 'scheme')).toThrow(
        'createCacheKey must be implemented by subclass'
      )
    })

    it('should throw error if createResponseBody is not implemented', () => {
      const baseBuilder = new BaseConceptCacheBuilder()
      expect(() => baseBuilder.createResponseBody('key', 'value')).toThrow(
        'createResponseBody must be implemented by subclass'
      )
    })
  })
})
