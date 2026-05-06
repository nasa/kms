/* eslint-disable max-classes-per-file */
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { BaseConceptCacheBuilder } from '../baseConceptCacheBuilder'

const mockExec = vi.fn(() => Promise.resolve())
const mockSet = vi.fn()
const mockMulti = vi.fn(() => ({
  set: mockSet,
  exec: mockExec
}))

const mockRedisClient = {
  multi: mockMulti,
  set: mockSet
}

vi.mock('../redisCacheStore', () => ({
  getRedisClient: vi.fn(() => Promise.resolve(mockRedisClient))
}))

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
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

// Large cache builder for batch testing
class LargeCacheBuilder extends BaseConceptCacheBuilder {
  parseCsvContent() {
    const records = new Map()
    // Create 2500 records (more than 2x BATCH_SIZE of 1000)
    for (let i = 0; i < 2500; i += 1) {
      records.set(`key${i}`, `value${i}`)
    }

    return records
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

  describe('processToCache', () => {
    beforeEach(() => {
      mockSet.mockClear()
      mockMulti.mockClear()
      mockExec.mockClear()
      mockExec.mockResolvedValue([])
    })

    it('should process all records and cache them using Redis pipeline', async () => {
      await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(mockMulti).toHaveBeenCalled()
      expect(mockSet).toHaveBeenCalledTimes(2)
      expect(mockSet).toHaveBeenCalledWith(
        'test:test-scheme:key1',
        JSON.stringify({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'key1',
            value: 'value1'
          })
        })
      )

      expect(mockSet).toHaveBeenCalledWith(
        'test:test-scheme:key2',
        JSON.stringify({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'key2',
            value: 'value2'
          })
        })
      )

      expect(mockExec).toHaveBeenCalled()
    })

    it('should skip records that fail shouldCache validation', async () => {
      // Override shouldCache to reject key2
      builder.shouldCache = (key) => key !== 'key2'

      await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(mockSet).toHaveBeenCalledTimes(1)
      expect(mockSet).toHaveBeenCalledWith(
        'test:test-scheme:key1',
        expect.any(String)
      )
    })

    it('should handle Redis client not being configured', async () => {
      const { getRedisClient } = await import('../redisCacheStore')
      vi.mocked(getRedisClient).mockResolvedValueOnce(null)

      await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(mockMulti).not.toHaveBeenCalled()
      expect(mockSet).not.toHaveBeenCalled()
    })

    it('should handle pipeline errors gracefully', async () => {
      mockExec.mockRejectedValueOnce(new Error('Pipeline failed'))

      // Should not throw
      await expect(
        builder.processToCache('csv content', { scheme: 'test-scheme' })
      ).resolves.toBeUndefined()
    })

    it('should process large datasets in batches', async () => {
      const largeBuilder = new LargeCacheBuilder()
      await largeBuilder.processToCache('csv content', { scheme: 'test-scheme' })

      // Should have called multi/exec 3 times (1000 + 1000 + 500)
      expect(mockMulti).toHaveBeenCalledTimes(3)
      expect(mockExec).toHaveBeenCalledTimes(3)
      expect(mockSet).toHaveBeenCalledTimes(2500)
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
