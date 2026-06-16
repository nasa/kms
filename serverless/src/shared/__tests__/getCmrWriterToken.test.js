import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { mockClient } from 'aws-sdk-client-mock'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn()
  }
}))

const secretsManagerMock = mockClient(SecretsManagerClient)

describe('getCmrWriterToken', () => {
  beforeEach(() => {
    vi.resetModules()
    secretsManagerMock.reset()
    delete process.env.CMR_WRITER_TOKEN
    delete process.env.CMR_WRITE_TOKEN
    delete process.env.CMR_WRITER_TOKEN_SECRET_NAME
    delete process.env.CMR_WRITE_TOKEN_SECRET_NAME
  })

  test('returns the direct environment token when present', async () => {
    process.env.CMR_WRITER_TOKEN = 'local-token'

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('local-token')
    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(0)
  })

  test('returns the alias environment token when present', async () => {
    process.env.CMR_WRITE_TOKEN = 'alias-local-token'

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('alias-local-token')
    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(0)
  })

  test('loads the token from a raw string secret', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({
      SecretString: 'secret-token'
    })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('secret-token')
    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(1)
  })

  test('loads the token from a JSON secret', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({
      SecretString: JSON.stringify({
        token: 'json-secret-token'
      })
    })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('json-secret-token')
  })

  test('loads the token from the alias secret-name environment variable', async () => {
    process.env.CMR_WRITE_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({
      SecretString: 'alias-secret-token'
    })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('alias-secret-token')
  })

  test('caches the secret after the first successful lookup', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({
      SecretString: 'secret-token'
    })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).resolves.toBe('secret-token')
    await expect(getCmrWriterToken()).resolves.toBe('secret-token')

    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(1)
  })

  test('reuses the Secrets Manager client after a failed lookup', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'

    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    })
      .resolvesOnce({
        SecretString: '   '
      })
      .resolves({
        SecretString: 'secret-token'
      })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow('CMR writer token secret is empty')
    await expect(getCmrWriterToken()).resolves.toBe('secret-token')

    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(2)
  })

  test('throws when no runtime token configuration exists', async () => {
    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow(
      'Missing CMR writer token configuration: set CMR_WRITER_TOKEN_SECRET_NAME'
    )
  })

  test('throws when the secret has no SecretString payload', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({})

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow(
      'CMR writer token secret cmr-writer-token did not include SecretString'
    )
  })

  test('throws when the secret string is empty after trimming', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({
      SecretString: '   '
    })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow('CMR writer token secret is empty')
  })

  test('throws when the secret string is null', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({
      SecretString: null
    })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow('CMR writer token secret is empty')
  })

  test('throws when the secret JSON omits a non-empty token field', async () => {
    process.env.CMR_WRITER_TOKEN_SECRET_NAME = 'cmr-writer-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-writer-token'
    }).resolves({
      SecretString: JSON.stringify({
        token: '   '
      })
    })

    const { getCmrWriterToken } = await import('../getCmrWriterToken')

    await expect(getCmrWriterToken()).rejects.toThrow(
      'CMR writer token secret JSON must include a non-empty "token" field'
    )
  })
})
