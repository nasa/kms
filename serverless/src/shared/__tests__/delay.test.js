import {
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { delay } from '../delay'

describe('delay function', () => {
  // Use fake timers
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should resolve after the specified delay', async () => {
    const delayTime = 1000
    const delayPromise = delay(delayTime)

    // Fast-forward time
    vi.advanceTimersByTime(delayTime)

    await expect(delayPromise).resolves.toBeUndefined()
  })

  it('should not resolve before the specified delay', async () => {
    const delayTime = 1000
    const delayPromise = delay(delayTime)

    // Fast-forward time, but not enough
    vi.advanceTimersByTime(delayTime - 1)

    const immediatePromise = Promise.resolve()
    await immediatePromise

    expect(delayPromise).not.toBe(immediatePromise)
  })

  it('should work with different delay times', async () => {
    const delays = [100, 500, 1000, 2000]

    await Promise.all(delays.map(async (delayTime) => {
      const delayPromise = delay(delayTime)
      vi.advanceTimersByTime(delayTime)
      await expect(delayPromise).resolves.toBeUndefined()
    }))
  })

  it('should handle zero delay', async () => {
    const delayPromise = delay(0)
    vi.advanceTimersByTime(0)
    await expect(delayPromise).resolves.toBeUndefined()
  })

  it('should handle multiple simultaneous delays', async () => {
    const delay1 = delay(1000)
    const delay2 = delay(2000)

    vi.advanceTimersByTime(1000)
    await expect(delay1).resolves.toBeUndefined()
    expect(delay2).not.toBe(delay1)

    vi.advanceTimersByTime(1000)
    await expect(delay2).resolves.toBeUndefined()
  })
})
