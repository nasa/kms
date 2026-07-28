import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCmrSystemToken, getCmrWriterToken } from '../getCmrWriterToken'

const {
  sendMock,
  warnMock,
  clientConfigs
} = vi.hoisted(() => ({
  sendMock: vi.fn(),
  warnMock: vi.fn(),
  clientConfigs: []
}))

const MOCK_SYSTEM_TOKEN_PARAMETER_NAME = '/test/kms/mock-system-token-parameter'

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
    process.env.CMR_WRITER_TOKEN = 'Bearer writer-token'

    await expect(getCmrWriterToken()).resolves.toBe('Bearer writer-token')

    expect(sendMock).not.toHaveBeenCalled()
  })

  test('trims the configured environment bearer token without altering it', async () => {
    process.env.CMR_WRITER_TOKEN = '  Bearer writer-token  '

    await expect(getCmrWriterToken()).resolves.toBe('Bearer writer-token')
  })

  test('treats a configured environment token without a bearer prefix as unusable', async () => {
    process.env.CMR_WRITER_TOKEN = 'writer-token'

    await expect(getCmrWriterToken({
      throwOnMissing: false
    })).resolves.toBe('')

    expect(warnMock).toHaveBeenCalledWith(
      '[cmr-token] Ignoring configured token that is missing a Bearer prefix',
      {
        source: 'env'
      }
    )
  })

  test('returns the SSM system token when configured and present', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.CMR_WRITER_TOKEN = 'Bearer writer-token'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'Bearer system-token'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('Bearer system-token')

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      input: {
        Name: MOCK_SYSTEM_TOKEN_PARAMETER_NAME,
        WithDecryption: true
      }
    }))
  })

  test('configures the SSM client with the optional endpoint and region overrides', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566'
    process.env.AWS_DEFAULT_REGION = 'us-east-1'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'Bearer system-token'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('Bearer system-token')

    expect(clientConfigs).toEqual([{
      endpoint: 'http://127.0.0.1:4566',
      region: 'us-east-1'
    }])
  })

  test('prefers AWS_REGION over AWS_DEFAULT_REGION when both are set', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.AWS_REGION = 'us-west-2'
    process.env.AWS_DEFAULT_REGION = 'us-east-1'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'Bearer system-token'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('Bearer system-token')

    expect(clientConfigs).toEqual([{
      region: 'us-west-2'
    }])
  })

  test('preserves bearer tokens as opaque authorization values', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'Bearer header.payload.signature'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('Bearer header.payload.signature')
  })

  test('falls back to the environment token when the SSM parameter cannot be read', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.CMR_WRITER_TOKEN = 'Bearer writer-token'
    sendMock.mockRejectedValueOnce(new Error('ParameterNotFound'))

    await expect(getCmrWriterToken()).resolves.toBe('Bearer writer-token')

    expect(warnMock).toHaveBeenCalledWith(
      '[cmr-token] Failed to read system token from SSM',
      {
        errorMessage: 'ParameterNotFound'
      }
    )
  })

  test('falls back to the environment token when the SSM parameter is present but empty', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.CMR_WRITER_TOKEN = 'Bearer writer-token'
    sendMock.mockResolvedValueOnce({})

    await expect(getCmrWriterToken()).resolves.toBe('Bearer writer-token')
  })

  test('falls back to the environment token when the SSM token is missing a bearer prefix', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.CMR_WRITER_TOKEN = 'Bearer writer-token'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'system-token'
      }
    })

    await expect(getCmrWriterToken()).resolves.toBe('Bearer writer-token')

    expect(warnMock).toHaveBeenCalledWith(
      '[cmr-token] Ignoring configured token that is missing a Bearer prefix',
      {
        source: 'ssm'
      }
    )
  })

  test('returns an empty string when no usable token exists and throwOnMissing is false', async () => {
    await expect(getCmrWriterToken({
      throwOnMissing: false
    })).resolves.toBe('')
  })

  test('throws when no usable token exists', async () => {
    await expect(getCmrWriterToken()).rejects.toThrow(
      'Missing usable CMR writer token configuration: set CMR_WRITER_TOKEN or configure CMR_SYSTEM_TOKEN_PARAMETER_NAME'
    )
  })
})

describe('getCmrSystemToken', () => {
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

  test('returns the SSM-backed system token when configured and present', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.CMR_WRITER_TOKEN = 'Bearer writer-token'
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'Bearer system-token'
      }
    })

    await expect(getCmrSystemToken()).resolves.toBe('Bearer system-token')
  })

  test('returns undefined when the system token is unavailable', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    process.env.CMR_WRITER_TOKEN = 'Bearer writer-token'
    sendMock.mockRejectedValueOnce(new Error('ParameterNotFound'))

    await expect(getCmrSystemToken()).resolves.toBeUndefined()
  })

  test('returns undefined when the configured SSM value is not a bearer token', async () => {
    process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = MOCK_SYSTEM_TOKEN_PARAMETER_NAME
    sendMock.mockResolvedValueOnce({
      Parameter: {
        Value: 'system-token'
      }
    })

    await expect(getCmrSystemToken()).resolves.toBeUndefined()

    expect(warnMock).toHaveBeenCalledWith(
      '[cmr-token] Ignoring configured token that is missing a Bearer prefix',
      {
        source: 'ssm'
      }
    )
  })
})
