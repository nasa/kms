import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

vi.mock('redis', () => ({
  createClient: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

const loadStore = async () => {
  const module = await import('@/shared/redisCacheStore')
  module.resetRedisClientStateForTests()

  return module
}

describe('when using redis cache store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.REDIS_ENABLED
    delete process.env.REDIS_HOST
    delete process.env.REDIS_PORT
  })

  describe('when reading cached json responses', () => {
    test('returns null when redis client is unavailable', async () => {
      process.env.REDIS_ENABLED = 'false'
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'k',
        entityLabel: 'response'
      })

      expect(result).toBeNull()
    })

    test('returns null when key is not found', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue(null)
      }
      const { createClient } = await import('redis')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'k',
        entityLabel: 'response'
      })

      expect(redisClient.get).toHaveBeenCalledWith('k')
      expect(result).toBeNull()
    })

    test('returns parsed payload when json is valid', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue('{"statusCode":200}')
      }
      const { createClient } = await import('redis')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'k',
        entityLabel: 'response'
      })

      expect(result).toEqual({ statusCode: 200 })
    })

    test('returns null and logs error when json is invalid', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue('{bad json')
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'k',
        entityLabel: 'response'
      })

      expect(result).toBeNull()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('when writing cached json responses', () => {
    test('returns when redis client is unavailable', async () => {
      process.env.REDIS_ENABLED = 'false'
      const store = await loadStore()

      await expect(store.setCachedJsonResponse({
        cacheKey: 'k',
        response: {
          statusCode: 200
        }
      })).resolves.toBeUndefined()
    })

    test('writes stringified payload to redis', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        set: vi.fn().mockResolvedValue('OK')
      }
      const { createClient } = await import('redis')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      await store.setCachedJsonResponse({
        cacheKey: 'k',
        response: {
          statusCode: 200,
          body: 'x'
        }
      })

      expect(redisClient.set).toHaveBeenCalledWith('k', JSON.stringify({
        statusCode: 200,
        body: 'x'
      }))
    })
  })

  describe('when clearing keys by prefix', () => {
    test('returns 0 when redis client is unavailable', async () => {
      process.env.REDIS_ENABLED = 'false'
      const store = await loadStore()

      const deleted = await store.clearCachedByPrefix({
        keyPrefix: 'kms:test'
      })

      expect(deleted).toBe(0)
    })

    test('returns 0 when first scan returns no keys and cursor 0', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        scan: vi.fn().mockResolvedValue({
          cursor: '0',
          keys: []
        }),
        del: vi.fn()
      }
      const { createClient } = await import('redis')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const deleted = await store.clearCachedByPrefix({
        keyPrefix: 'kms:test'
      })

      expect(redisClient.scan).toHaveBeenCalledWith('0', {
        MATCH: 'kms:test:*',
        COUNT: 500
      })

      expect(redisClient.del).not.toHaveBeenCalled()
      expect(deleted).toBe(0)
    })

    test('clears keys across multiple cursors and returns total deleted', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        scan: vi.fn()
          .mockResolvedValueOnce({
            cursor: '1',
            keys: ['kms:test:a', 'kms:test:b']
          })
          .mockResolvedValueOnce({
            cursor: '0',
            keys: ['kms:test:c']
          }),
        del: vi.fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const deleted = await store.clearCachedByPrefix({
        keyPrefix: 'kms:test'
      })

      expect(redisClient.del).toHaveBeenNthCalledWith(1, ['kms:test:a', 'kms:test:b'])
      expect(redisClient.del).toHaveBeenNthCalledWith(2, ['kms:test:c'])
      expect(deleted).toBe(3)
      expect(logger.debug).toHaveBeenCalled()
    })

    test('stops when cursor repeats to prevent loop', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        scan: vi.fn()
          .mockResolvedValueOnce({
            cursor: '1',
            keys: ['kms:test:a']
          })
          .mockResolvedValueOnce({
            cursor: '1',
            keys: ['kms:test:b']
          }),
        del: vi.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const deleted = await store.clearCachedByPrefix({
        keyPrefix: 'kms:test'
      })

      expect(deleted).toBe(2)
      expect(logger.warn).toHaveBeenCalled()
    })
  })
})
