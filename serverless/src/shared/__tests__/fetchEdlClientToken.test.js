import * as getConfig from '@/shared/getConfig'

import fetchEdlClientToken from '../fetchEdlClientToken'
import { logger } from '../logger'

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(getConfig, 'getEdlConfig').mockImplementation(() => ({
    host: 'https://localtest.urs.earthdata.nasa.gov',
    uid: 'kms_test'
  }))

  process.env.EDL_PASSWORD = 'test'
})

global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({
    access_token: 'mock_token',
    token_type: 'Bearer',
    expires_in: 1296000
  })
}))

describe('Retrieving EDL Client Token', () => {
  test('returns token', async () => {
    const token = await fetchEdlClientToken()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('https://localtest.urs.earthdata.nasa.gov/oauth/token', {
      body: 'grant_type=client_credentials',
      headers: {
        Authorization: 'Basic a21zX3Rlc3Q6dGVzdA==',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      method: 'POST'
    })

    expect(token).toEqual('mock_token')
  })

  test('returns undefined when the response from EDL is an error', async () => {
    fetch.mockImplementationOnce(() => Promise.reject(new Error('Error calling EDL')))

    const token = await fetchEdlClientToken()
      .catch((error) => {
        expect(error.message).toEqual('Error calling EDL')
      })

    expect(token).toEqual(undefined)
  })

  test('throws an error when response is not OK', async () => {
  // Mock fetch to return a non-OK response
    fetch.mockImplementationOnce(() => Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad Request' })
    }))

    await expect(fetchEdlClientToken()).rejects.toThrow('EDL request failed with status 400')

    expect(logger.error).toHaveBeenCalledWith('Error response:', expect.objectContaining({
      ok: false,
      status: 400
    }))
  })

  test('throws an error when no access token is received', async () => {
  // Mock fetch to return a response without an access_token
    fetch.mockImplementationOnce(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        token_type: 'Bearer',
        expires_in: 1296000
      // Access_token is intentionally omitted
      })
    }))

    // Expect the function to throw an error
    await expect(fetchEdlClientToken()).rejects.toThrow('No access token received from EDL')

    // Verify all logger.debug calls in order
    expect(logger.debug).toHaveBeenNthCalledWith(1, 'Starting to fetch EDL client token')
    expect(logger.debug).toHaveBeenNthCalledWith(2, 'EDL host:', 'https://localtest.urs.earthdata.nasa.gov')
    expect(logger.debug).toHaveBeenNthCalledWith(3, 'EDL UID:', 'kms_test')
    expect(logger.debug).toHaveBeenNthCalledWith(4, 'EDL password:', 'Present')
    expect(logger.debug).toHaveBeenNthCalledWith(5, 'Token URL:', 'https://localtest.urs.earthdata.nasa.gov/oauth/token')
    expect(logger.debug).toHaveBeenNthCalledWith(6, 'Sending request to EDL')
    expect(logger.debug).toHaveBeenNthCalledWith(7, 'Response status:', 200)
    expect(logger.debug).toHaveBeenNthCalledWith(8, 'Response body:', '{\n  "token_type": "Bearer",\n  "expires_in": 1296000\n}')
    expect(logger.debug).toHaveBeenNthCalledWith(9, 'Access token:', 'Not present')

    // Verify logger.error calls
    expect(logger.error).toHaveBeenNthCalledWith(1, 'No access token received in response')
    expect(logger.error).toHaveBeenNthCalledWith(2, 'Error fetching EDL client token:', expect.any(Error))
  })
})
