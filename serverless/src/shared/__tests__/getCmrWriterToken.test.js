import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

describe('getCmrWriterToken', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.CMR_WRITER_TOKEN
  })

  test('returns the configured environment token when present', async () => {
    process.env.CMR_WRITER_TOKEN = 'writer-token'

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')
  })

  test('trims the configured environment token', async () => {
    process.env.CMR_WRITER_TOKEN = '  writer-token  '

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')
  })

  test('caches the token after the first successful lookup', async () => {
    process.env.CMR_WRITER_TOKEN = 'writer-token'

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')

    process.env.CMR_WRITER_TOKEN = 'updated-token'

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')
  })

  test('throws when no runtime token configuration exists', async () => {
    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow(
      'Missing CMR writer token configuration: set CMR_WRITER_TOKEN'
    )
  })

  test('throws when the configured token is empty after trimming', async () => {
    process.env.CMR_WRITER_TOKEN = '   '

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow(
      'Missing CMR writer token configuration: set CMR_WRITER_TOKEN'
    )
  })
})
