import {
  afterEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

vi.mock('redis', () => ({
  createClient: vi.fn()
}))

describe('getRedisClient', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.REDIS_ENABLED
    delete process.env.REDIS_HOST
    delete process.env.REDIS_PORT
  })

  describe('when redis is not configured', () => {
    test('returns null client', async () => {
      process.env.REDIS_ENABLED = 'false'

      const module = await import('@/shared/redisCacheStore')
      const client = await module.getRedisClient()

      expect(client).toBeNull()
      expect(module.isRedisConfigured()).toBe(false)
    })

    test('logs unconfigured state only once across repeated calls', async () => {
      process.env.REDIS_ENABLED = 'false'
      const module = await import('@/shared/redisCacheStore')
      const { logger } = await import('@/shared/logger')
      const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})

      await module.getRedisClient()
      await module.getRedisClient()

      expect(infoSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('when redis is configured', () => {
    test('creates and connects a redis client once', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const connect = vi.fn().mockResolvedValue(undefined)
      const on = vi.fn()
      const { createClient } = await import('redis')
      createClient.mockReturnValue({
        connect,
        on
      })

      const module = await import('@/shared/redisCacheStore')
      const client1 = await module.getRedisClient()
      const client2 = await module.getRedisClient()

      expect(client1).toEqual({
        connect,
        on
      })

      expect(client2).toEqual({
        connect,
        on
      })

      expect(connect).toHaveBeenCalledTimes(1)
    })

    test('returns null and resets state when connect fails', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const connect = vi.fn().mockRejectedValue(new Error('connect failed'))
      const on = vi.fn()
      const { createClient } = await import('redis')
      createClient.mockReturnValue({
        connect,
        on
      })

      const module = await import('@/shared/redisCacheStore')
      const client = await module.getRedisClient()

      expect(client).toBeNull()

      module.resetRedisClientStateForTests()
      const secondClient = await module.getRedisClient()
      expect(secondClient).toBeNull()
    })

    test('does not log configured message again after a failed connect retry', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      const connect = vi.fn().mockRejectedValue(new Error('connect failed'))
      const on = vi.fn()
      const { logger } = await import('@/shared/logger')
      const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
      const { createClient } = await import('redis')
      createClient.mockReturnValue({
        connect,
        on
      })

      const module = await import('@/shared/redisCacheStore')
      await module.getRedisClient()
      await module.getRedisClient()

      expect(connect).toHaveBeenCalledTimes(2)
      expect(infoSpy).toHaveBeenCalledWith('Redis configured: host=localhost, port=6379')
      expect(infoSpy).toHaveBeenCalledTimes(1)
    })

    test('logs client error callback from redis client', async () => {
      process.env.REDIS_ENABLED = 'true'
      process.env.REDIS_HOST = 'localhost'
      process.env.REDIS_PORT = '6379'

      let onErrorHandler
      const connect = vi.fn().mockResolvedValue(undefined)
      const on = vi.fn((event, handler) => {
        if (event === 'error') {
          onErrorHandler = handler
        }
      })

      const { createClient } = await import('redis')
      createClient.mockReturnValue({
        connect,
        on
      })

      const module = await import('@/shared/redisCacheStore')
      await module.getRedisClient()
      expect(typeof onErrorHandler).toBe('function')
      expect(() => onErrorHandler(new Error('redis runtime error'))).not.toThrow()
    })
  })
})
