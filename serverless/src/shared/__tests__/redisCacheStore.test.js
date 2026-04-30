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
    delete process.env.REDIS_FAIL_FAST
  })

  describe('when creating a redis client', () => {
    test('logs disabled redis configuration only once across repeated calls', async () => {
      process.env.REDIS_ENABLED = 'false'

      const { logger } = await import('@/shared/logger')
      const store = await loadStore()

      await expect(store.getRedisClient()).resolves.toBeNull()
      await expect(store.getRedisClient()).resolves.toBeNull()

      expect(logger.info).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith(
        'Redis disabled or not configured: REDIS_ENABLED=false, REDIS_HOST=undefined, REDIS_PORT=6379'
      )
    })

    test('configures fail-fast socket options and logs redis client errors', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'
      process.env.REDIS_FAIL_FAST = 'true'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const client = await store.getRedisClient()

      expect(client).toBe(redisClient)
      expect(createClient).toHaveBeenCalledWith({
        socket: expect.objectContaining({
          host: 'localhost',
          port: 6379,
          connectTimeout: 5000,
          reconnectStrategy: expect.any(Function)
        })
      })

      const [{ socket }] = createClient.mock.calls[0]
      expect(socket.reconnectStrategy()).toBe(false)

      const errorHandler = redisClient.on.mock.calls.find(([eventName]) => eventName === 'error')[1]
      errorHandler('boom')

      expect(logger.error).toHaveBeenCalledWith('Redis client error: boom')
    })

    test('returns null and resets the cached promise when connect fails', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const failingClient = {
        connect: vi.fn().mockRejectedValue(new Error('connect failed')),
        on: vi.fn()
      }
      const workingClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient
        .mockReturnValueOnce(failingClient)
        .mockReturnValueOnce(workingClient)

      const store = await loadStore()

      await expect(store.getRedisClient()).resolves.toBeNull()
      await expect(store.getRedisClient()).resolves.toBe(workingClient)

      expect(createClient).toHaveBeenCalledTimes(2)
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Redis connect failed: Error: connect failed')
      )
    })

    test('reuses the same redis client promise after a successful connection', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn()
      }
      const { createClient } = await import('redis')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const firstClient = await store.getRedisClient()
      const secondClient = await store.getRedisClient()

      expect(firstClient).toBe(redisClient)
      expect(secondClient).toBe(redisClient)
      expect(createClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('when reading cached json responses', () => {
    test('returns null and bypasses redis when the cache key is for draft', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn()
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'kms:concept:draft:test',
        entityLabel: 'response'
      })

      expect(result).toBeNull()
      expect(createClient).not.toHaveBeenCalled()
      expect(redisClient.get).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] skip-read version=draft endpoint=kms:concept key=kms:concept:draft:test'
      )
    })

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
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'kms:concepts:published:test',
        entityLabel: 'response',
        format: 'json'
      })

      expect(redisClient.get).toHaveBeenCalledWith('kms:concepts:published:test')
      expect(result).toBeNull()
      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] miss endpoint=kms:concepts format=json key=kms:concepts:published:test'
      )
    })

    test('logs key-only read context when cache key is empty', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue(null)
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: '',
        entityLabel: 'response'
      })

      expect(result).toBeNull()
      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] miss key='
      )
    })

    test('logs format and key when cache key is empty but format is provided', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue(null)
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: '',
        format: 'json'
      })

      expect(result).toBeNull()
      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] miss format=json key='
      )
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
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'kms:concepts:published:test',
        entityLabel: 'response',
        format: 'json'
      })

      expect(result).toEqual({ statusCode: 200 })
      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] hit endpoint=kms:concepts format=json key=kms:concepts:published:test'
      )
    })

    test('uses the first two cache-key segments for tree cache logs', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        get: vi.fn().mockResolvedValue(null)
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      const result = await store.getCachedJsonResponse({
        cacheKey: 'kms:tree:published:instruments:',
        entityLabel: 'tree response'
      })

      expect(result).toBeNull()
      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] miss endpoint=kms:tree key=kms:tree:published:instruments:'
      )
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
    test('returns and bypasses redis writes when the cache key is for draft', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        set: vi.fn()
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      await expect(store.setCachedJsonResponse({
        cacheKey: 'kms:concept:draft:test',
        response: {
          statusCode: 200
        }
      })).resolves.toBeUndefined()

      expect(createClient).not.toHaveBeenCalled()
      expect(redisClient.set).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] skip-write version=draft endpoint=kms:concept key=kms:concept:draft:test'
      )
    })

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
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      await store.setCachedJsonResponse({
        cacheKey: 'kms:concepts:published:test',
        response: {
          statusCode: 200,
          body: 'x'
        },
        format: 'json'
      })

      expect(redisClient.set).toHaveBeenCalledWith('kms:concepts:published:test', JSON.stringify({
        statusCode: 200,
        body: 'x'
      }))

      expect(logger.debug).toHaveBeenCalledWith(
        '[cache] write endpoint=kms:concepts format=json key=kms:concepts:published:test'
      )
    })

    test('uses the first two cache-key segments for write logs', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        set: vi.fn().mockResolvedValue('OK')
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      await store.setCachedJsonResponse({
        cacheKey: 'custom:key',
        response: {
          statusCode: 200
        }
      })

      expect(logger.debug).toHaveBeenCalledWith('[cache] write endpoint=custom:key key=custom:key')
    })

    test('logs key-only write context when cache key is empty', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const redisClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        set: vi.fn().mockResolvedValue('OK')
      }
      const { createClient } = await import('redis')
      const { logger } = await import('@/shared/logger')
      createClient.mockReturnValue(redisClient)
      const store = await loadStore()

      await store.setCachedJsonResponse({
        cacheKey: '',
        response: {
          statusCode: 200
        }
      })

      expect(logger.debug).toHaveBeenCalledWith('[cache] write key=')
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
