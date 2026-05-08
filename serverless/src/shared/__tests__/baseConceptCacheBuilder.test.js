/* eslint-disable max-classes-per-file */
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { BaseConceptCacheBuilder } from '../baseConceptCacheBuilder'

const mockMSet = vi.fn(() => Promise.resolve())

const mockRedisClient = {
  mSet: mockMSet
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
      mockMSet.mockClear()
      mockMSet.mockResolvedValue(undefined)
    })

    it('should process all records and cache them using Redis mSet', async () => {
      await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(mockMSet).toHaveBeenCalled()

      // Verify the mSet call contains the expected key-value pairs
      const calls = mockMSet.mock.calls[0][0]
      expect(calls.length).toBe(4) // 2 entries * 2 (key + value)

      const expectedResponse1 = JSON.stringify({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'key1',
          value: 'value1'
        })
      })

      const expectedResponse2 = JSON.stringify({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'key2',
          value: 'value2'
        })
      })

      expect(calls).toContain('test:test-scheme:key1')
      expect(calls).toContain('test:test-scheme:key2')
      expect(calls).toContain(expectedResponse1)
      expect(calls).toContain(expectedResponse2)
    })

    it('should skip records that fail shouldCache validation', async () => {
      // Override shouldCache to reject key2
      builder.shouldCache = (key) => key !== 'key2'

      await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(mockMSet).toHaveBeenCalled()

      // Verify only key1 is in the mSet call
      const calls = mockMSet.mock.calls[0][0]
      expect(calls.length).toBe(2) // 1 entry * 2 (key + value)
      expect(calls[0]).toBe('test:test-scheme:key1')
      expect(calls).not.toContain('test:test-scheme:key2')
    })

    it('should handle Redis client not being configured', async () => {
      const { getRedisClient } = await import('../redisCacheStore')
      vi.mocked(getRedisClient).mockResolvedValueOnce(null)

      const result = await builder.processToCache('csv content', { scheme: 'test-scheme' })

      expect(mockMSet).not.toHaveBeenCalled()
      expect(result).toEqual({
        attemptedCount: 0,
        writtenCount: 0,
        failedCount: 0,
        skipped: true
      })
    })

    it('should handle empty cache entries when all records fail validation', async () => {
      const { logger } = await import('../logger')

      // Override shouldCache to reject all records
      builder.shouldCache = () => false

      const result = await builder.processToCache('csv content', { scheme: 'test-scheme' })

      // Should not call mSet when there are no entries to cache
      expect(mockMSet).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith('No entries to cache')
      expect(result).toEqual({
        attemptedCount: 0,
        writtenCount: 0,
        failedCount: 0,
        skipped: false
      })
    })

    it('should handle mSet errors gracefully', async () => {
      mockMSet.mockRejectedValueOnce(new Error('mSet failed'))

      await expect(
        builder.processToCache('csv content', { scheme: 'test-scheme' })
      ).resolves.toEqual({
        attemptedCount: 2,
        writtenCount: 0,
        failedCount: 2,
        skipped: false
      })
    })

    it('should process large datasets in batches', async () => {
      const largeBuilder = new LargeCacheBuilder()
      await largeBuilder.processToCache('csv content', { scheme: 'test-scheme' })

      // Should have called mSet 3 times (1000 + 1000 + 500)
      expect(mockMSet).toHaveBeenCalledTimes(3)

      // Verify batch sizes
      const { calls } = mockMSet.mock
      expect(calls[0][0].length).toBe(2000) // 1000 entries * 2
      expect(calls[1][0].length).toBe(2000) // 1000 entries * 2
      expect(calls[2][0].length).toBe(1000) // 500 entries * 2
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
