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

describe('getCmrSystemToken', () => {
  beforeEach(() => {
    vi.resetModules()
    secretsManagerMock.reset()
    delete process.env.CMR_SYSTEM_TOKEN
    delete process.env.CMR_SYSTEM_TOKEN_SECRET_NAME
  })

  test('returns the direct environment token when present', async () => {
    process.env.CMR_SYSTEM_TOKEN = 'local-token'

    const { getCmrSystemToken } = await import('../getCmrSystemToken')

    await expect(getCmrSystemToken()).resolves.toBe('local-token')
    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(0)
  })

  test('loads the token from a raw string secret', async () => {
    process.env.CMR_SYSTEM_TOKEN_SECRET_NAME = 'cmr-system-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-system-token'
    }).resolves({
      SecretString: 'secret-token'
    })

    const { getCmrSystemToken } = await import('../getCmrSystemToken')

    await expect(getCmrSystemToken()).resolves.toBe('secret-token')
    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(1)
  })

  test('loads the token from a JSON secret', async () => {
    process.env.CMR_SYSTEM_TOKEN_SECRET_NAME = 'cmr-system-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-system-token'
    }).resolves({
      SecretString: JSON.stringify({
        token: 'json-secret-token'
      })
    })

    const { getCmrSystemToken } = await import('../getCmrSystemToken')

    await expect(getCmrSystemToken()).resolves.toBe('json-secret-token')
  })

  test('caches the secret after the first successful lookup', async () => {
    process.env.CMR_SYSTEM_TOKEN_SECRET_NAME = 'cmr-system-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-system-token'
    }).resolves({
      SecretString: 'secret-token'
    })

    const { getCmrSystemToken } = await import('../getCmrSystemToken')

    await expect(getCmrSystemToken()).resolves.toBe('secret-token')
    await expect(getCmrSystemToken()).resolves.toBe('secret-token')

    expect(secretsManagerMock.commandCalls(GetSecretValueCommand)).toHaveLength(1)
  })

  test('throws when no runtime token configuration exists', async () => {
    const { getCmrSystemToken } = await import('../getCmrSystemToken')

    await expect(getCmrSystemToken()).rejects.toThrow(
      'Missing CMR system token configuration: set CMR_SYSTEM_TOKEN_SECRET_NAME'
    )
  })

  test('throws when the secret has no SecretString payload', async () => {
    process.env.CMR_SYSTEM_TOKEN_SECRET_NAME = 'cmr-system-token'
    secretsManagerMock.on(GetSecretValueCommand, {
      SecretId: 'cmr-system-token'
    }).resolves({})

    const { getCmrSystemToken } = await import('../getCmrSystemToken')

    await expect(getCmrSystemToken()).rejects.toThrow(
      'CMR system token secret cmr-system-token did not include SecretString'
    )
  })
})
