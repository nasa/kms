import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCmrWriterToken, getCmrWriterTokenDebugInfo } from '../getCmrWriterToken'

const {
  sendMock,
  warnMock,
  clientConfigs
} = vi.hoisted(() => ({
  sendMock: vi.fn(),
  warnMock: vi.fn(),
  clientConfigs: []
}))

function MockSsmClient(config) {
  clientConfigs.push(config)

  return {
    send: sendMock
  }
}

function MockGetParameterCommand(input) {
  this.input = input
}

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: MockSsmClient,
  GetParameterCommand: MockGetParameterCommand
}))

vi.mock('../logger', () => ({
  logger: {
    warn: warnMock
  }
}))

const encodeBase64Url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '')

const createJwt = ({ exp }) => {
  const header = encodeBase64Url(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT'
  }))
  const payload = encodeBase64Url(JSON.stringify({ exp }))

  return `${header}.${payload}.signature`
}

describe('getCmrWriterToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMock.mockReset()
    warnMock.mockReset()
    clientConfigs.length = 0
    delete process.env.CMR_WRITER_TOKEN
    delete process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME
    delete process.env.AWS_ENDPOINT_URL
    delete process.env.AWS_REGION
    delete process.env.AWS_DEFAULT_REGION
  })

  test('returns the configured environment token when no SSM parameter is configured', async () => {
    process.env.CMR_WRITER_TOKEN = 'writer-token'

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')

    expect(sendMock).not.toHaveBeenCalled()
  })

  test('trims and strips an optional bearer prefix from the configured environment token', async () => {
    process.env.CMR_WRITER_TOKEN = '  Bearer writer-token  '

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')
  })

  test('returns the SSM system token when configured and present', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    process.env.CMR_WRITER_TOKEN = 'writer-token'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'system-token'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('system-token')

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      input: {
        Name: '/uat/bootstrap/CMR_SYSTEM_TOKEN',
        WithDecryption: true
      }
    }))
  })

  test('configures the SSM client with the optional endpoint and region overrides', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566'
    process.env.AWS_DEFAULT_REGION = 'us-east-1'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'system-token'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('system-token')

    expect(clientConfigs).toEqual([{
      endpoint: 'http://127.0.0.1:4566',
      region: 'us-east-1'
    }])
  })

  test('prefers AWS_REGION over AWS_DEFAULT_REGION when both are set', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    process.env.AWS_REGION = 'us-west-2'
    process.env.AWS_DEFAULT_REGION = 'us-east-1'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'system-token'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('system-token')

    expect(clientConfigs).toEqual([{
      region: 'us-west-2'
    }])
  })

  test('falls back to the environment token when the SSM token is expired', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    process.env.CMR_WRITER_TOKEN = 'writer-token'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: createJwt({
          exp: Math.floor(Date.now() / 1000) - 60
        })
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')

    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  test('preserves a JWT-shaped token when its expiration claim is invalid', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    const token = createJwt({ exp: 0 })
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: token
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe(token)
  })

  test('preserves malformed JWT-shaped tokens when no expiration can be decoded', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'header.invalid-json.signature'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('header.invalid-json.signature')
  })

  test('falls back to the environment token when the SSM parameter cannot be read', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    process.env.CMR_WRITER_TOKEN = 'writer-token'
    sendMock.mockRejectedValueOnce(new Error('ParameterNotFound'))

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')

    expect(warnMock).toHaveBeenCalledWith(
      '[cmr-writeback] Failed to read system token from SSM; falling back to CMR_WRITER_TOKEN',
      {
        errorMessage: 'ParameterNotFound'
      }
    )
  })

  test('falls back to the environment token when the SSM parameter is present but empty', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    process.env.CMR_WRITER_TOKEN = 'writer-token'
    sendMock.mockResolvedValueOnce({})

    await expect(getCmrWriterToken()).resolves.toBe('writer-token')
  })

  test('returns an empty string when no usable token exists and throwOnMissing is false', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: createJwt({
          exp: Math.floor(Date.now() / 1000) - 60
        })
      }
    })

    await expect(getCmrWriterToken({
      throwOnMissing: false
    })).resolves.toBe('')
  })

  test('throws when no usable token exists', async () => {
    await expect(getCmrWriterToken()).rejects.toThrow(
      'Missing usable CMR writer token configuration: set CMR_WRITER_TOKEN or configure CMR_SYSTEM_TOKEN_PARAMETER_NAME'
    )
  })

  test('returns non-sensitive debug characteristics for the resolved SSM token', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: `Bearer ${createJwt({
          exp: Math.floor(Date.now() / 1000) + 3600
        })}`
      }
    })

    await expect(getCmrWriterTokenDebugInfo()).resolves.toEqual({
      source: 'ssm',
      hasBearerPrefix: true,
      tokenLength: expect.any(Number),
      jwtShaped: true,
      hasDecodedExp: true,
      fingerprint: expect.stringMatching(/^[a-f0-9]{12}$/)
    })
  })

  test('returns env-based debug characteristics when the SSM token cannot be read', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = '/uat/bootstrap/CMR_SYSTEM_TOKEN'
    process.env.CMR_WRITER_TOKEN = 'writer-token'
    sendMock.mockRejectedValueOnce(new Error('ParameterNotFound'))

    await expect(getCmrWriterTokenDebugInfo()).resolves.toEqual({
      source: 'env',
      hasBearerPrefix: false,
      tokenLength: 'writer-token'.length,
      jwtShaped: false,
      hasDecodedExp: false,
      fingerprint: expect.stringMatching(/^[a-f0-9]{12}$/)
    })
  })

  test('returns empty debug characteristics when no token is configured', async () => {
    await expect(getCmrWriterTokenDebugInfo()).resolves.toEqual({
      source: 'none',
      hasBearerPrefix: false,
      tokenLength: 0,
      jwtShaped: false,
      hasDecodedExp: false,
      fingerprint: ''
    })
  })
})
