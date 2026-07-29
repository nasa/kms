import {
  describe,
  expect,
  vi
} from 'vitest'

import { delay } from '../delay'

describe('delay function', () => {
  test('should resolve after the specified delay', async () => {
    vi.useFakeTimers()
    const promise = delay(1000)
    vi.advanceTimersByTime(1000)
    await expect(promise).resolves.toBeUndefined()
    vi.useRealTimers()
  })

  test('should not resolve before the specified delay', async () => {
    vi.useFakeTimers()
    let resolved = false
    delay(1000).then(() => { resolved = true })

    vi.advanceTimersByTime(500)
    expect(resolved).toBe(false)

    vi.advanceTimersByTime(500)
    // Flush microtasks
    await vi.runAllTimersAsync()
    expect(resolved).toBe(true)
    vi.useRealTimers()
  })

  test('should work with different delay times', async () => {
    vi.useFakeTimers()
    const p1 = delay(500)
    const p2 = delay(2000)

    vi.advanceTimersByTime(500)
    await expect(p1).resolves.toBeUndefined()

    vi.advanceTimersByTime(1500)
    await expect(p2).resolves.toBeUndefined()
    vi.useRealTimers()
  })

  test('should handle zero delay', async () => {
    vi.useFakeTimers()
    const promise = delay(0)
    vi.advanceTimersByTime(0)
    await expect(promise).resolves.toBeUndefined()
    vi.useRealTimers()
  })

  test('should handle multiple simultaneous delays', async () => {
    vi.useFakeTimers()
    const promises = [delay(100), delay(100), delay(100)]
    vi.advanceTimersByTime(100)
    await Promise.all(promises)
    vi.useRealTimers()
  })
})
