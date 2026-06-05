import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { writeCacheEntries } from '../writeCacheEntries'

describe('writeCacheEntries', () => {
  test('returns zero and skips redis writes when no cache entries are provided', async () => {
    const redisClient = {
      mSet: vi.fn()
    }

    await expect(writeCacheEntries({
      cacheEntries: [],
      redisClient
    })).resolves.toBe(0)

    expect(redisClient.mSet).not.toHaveBeenCalled()
  })

  test('writes cache entries in fixed-size batches and returns the total written count', async () => {
    const redisClient = {
      mSet: vi.fn().mockResolvedValue(undefined)
    }
    const cacheEntries = Array.from({ length: 1001 }, (_, index) => ({
      key: `key-${index}`,
      value: `value-${index}`
    }))

    await expect(writeCacheEntries({
      cacheEntries,
      redisClient
    })).resolves.toBe(1001)

    expect(redisClient.mSet).toHaveBeenCalledTimes(2)
    expect(redisClient.mSet).toHaveBeenNthCalledWith(
      1,
      cacheEntries.slice(0, 1000).flatMap(({ key, value }) => [key, value])
    )

    expect(redisClient.mSet).toHaveBeenNthCalledWith(
      2,
      cacheEntries.slice(1000).flatMap(({ key, value }) => [key, value])
    )
  })
})
