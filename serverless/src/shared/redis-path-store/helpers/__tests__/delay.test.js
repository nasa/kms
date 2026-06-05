import { delay } from '../delay'

describe('delay', () => {
  test('resolves after the requested timeout', async () => {
    vi.useFakeTimers()

    const onResolved = vi.fn()
    const pending = delay(25).then(onResolved)

    expect(onResolved).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(24)
    expect(onResolved).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await pending

    expect(onResolved).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})
