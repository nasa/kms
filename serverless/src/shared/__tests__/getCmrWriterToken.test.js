import {
  beforeEach,
  describe,
  expect,
  test
} from 'vitest'

import { getCmrWriterToken } from '../getCmrWriterToken'

describe('getCmrWriterToken', () => {
  beforeEach(() => {
    delete process.env.CMR_WRITER_TOKEN
  })

  test('returns the configured environment token when present', async () => {
    process.env.CMR_WRITER_TOKEN = 'writer-token'

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')
  })

  test('trims the configured environment token', async () => {
    process.env.CMR_WRITER_TOKEN = '  writer-token  '

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')
  })

  test('reads the current environment token on each call', async () => {
    process.env.CMR_WRITER_TOKEN = 'writer-token'

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')

    process.env.CMR_WRITER_TOKEN = 'updated-token'

    await expect(getCmrWriterToken()).resolves.toBe('updated-token')
  })

  test('throws when no runtime token configuration exists', async () => {
    await expect(getCmrWriterToken()).rejects.toThrow(
      'Missing CMR writer token configuration: set CMR_WRITER_TOKEN'
    )
  })

  test('throws when the configured token is empty after trimming', async () => {
    process.env.CMR_WRITER_TOKEN = '   '

    await expect(getCmrWriterToken()).rejects.toThrow(
      'Missing CMR writer token configuration: set CMR_WRITER_TOKEN'
    )
  })
})
