import * as getConfig from '@/shared/getConfig'

import fetchEdlClientToken from '../fetchEdlClientToken'

let consoleLogSpy
let consoleErrorSpy

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(getConfig, 'getEdlConfig').mockImplementation(() => ({
    host: 'https://localtest.urs.earthdata.nasa.gov',
    uid: 'kms_test'
  }))

  process.env.EDL_PASSWORD = 'test'
  // Spy on console.log and console.error
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // Restore console.log and console.error after each test
  consoleLogSpy.mockRestore()
  consoleErrorSpy.mockRestore()
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

    // Verify that console.error was called with the expected message
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '#fetchEdlClientToken Error response:',
      expect.objectContaining({
        ok: false,
        status: 400
      })
    )
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

    await expect(fetchEdlClientToken()).rejects.toThrow('No access token received from EDL')

    // Verify that console.error was called with the expected message
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '#fetchEdlClientToken No access token received in response'
    )

    // Verify that console.log was called with the response body
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '#fetchEdlClientToken Response body:',
      JSON.stringify({
        token_type: 'Bearer',
        expires_in: 1296000
      }, null, 2)
    )
  })
})
