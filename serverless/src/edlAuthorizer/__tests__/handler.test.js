import fetchEdlProfile from '@/shared/fetchEdlProfile'

import edlAuthorizer from '../handler'

vi.mock('@/shared/fetchEdlProfile')

describe('edlAuthorizer', () => {
  const OLD_ENV = process.env
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  beforeEach(() => {
    process.env = { ...OLD_ENV }
    console.log = vi.fn()
    console.error = vi.fn()
    fetchEdlProfile.mockReset()
    fetchEdlProfile.mockResolvedValue({
      email: 'test.user@localhost',
      first_name: 'Test',
      last_name: 'User',
      uid: 'mock_user',
      assuranceLevel: 5
    })
  })

  afterEach(() => {
    process.env = OLD_ENV
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  describe('when the token is for a valid user', () => {
    test('returns a valid policy', async () => {
      fetchEdlProfile.mockImplementation(() => ({
        email: 'test.user@localhost',
        first_name: 'Test',
        last_name: 'User',
        uid: 'mock_user',
        assuranceLevel: 5
      }))

      const event = {
        headers: {
          Authorization: 'mock-token'
        }
      }

      const response = await edlAuthorizer(event, {})

      expect(response).toEqual({
        principalId: 'mock_user'
      })
    })
  })

  describe('when the token is provided in authorizationToken', () => {
    test('uses the authorizationToken and returns a valid policy', async () => {
      const event = {
        authorizationToken: 'mock-token-in-event',
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/stage/method/resourcepath'
      }

      const response = await edlAuthorizer(event, {})

      expect(response).toEqual({
        principalId: 'mock_user',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Allow',
              Resource: event.methodArn
            }
          ]
        }
      })

      // Verify that fetchEdlProfile was called with the correct token
      expect(fetchEdlProfile).toHaveBeenCalledWith('mock-token-in-event')
    })
  })

  describe('when running offline', () => {
    test('returns a valid policy', async () => {
      process.env.IS_OFFLINE = true

      const event = {
        headers: {
          Authorization: 'ABC-1'
        }
      }

      const response = await edlAuthorizer(event, {})

      expect(response).toEqual({
        principalId: 'mock_user'
      })
    })
  })

  describe('when the supplied token is invalid', () => {
    test('returns unauthorized', async () => {
      fetchEdlProfile.mockImplementationOnce(() => false)

      await expect(
        edlAuthorizer({}, {})
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('when the assurance level is below 5', () => {
    test('throws an unauthorized error', async () => {
      fetchEdlProfile.mockResolvedValueOnce({
        uid: 'mock_user',
        assuranceLevel: 3
      })

      await expect(edlAuthorizer({}, {})).rejects.toThrow('Unauthorized')
    })
  })
})
