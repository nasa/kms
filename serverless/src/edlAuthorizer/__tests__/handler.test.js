import fetchEdlProfile from '@/shared/fetchEdlProfile'
import { logger } from '@/shared/logger'

import edlAuthorizer from '../handler'

vi.mock('@/shared/fetchEdlProfile')

describe('edlAuthorizer', () => {
  const OLD_ENV = process.env
  const originalConsoleLog = console.log
  const originalConsoleError = console.error
  let loggerErrorSpy

  beforeEach(() => {
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
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

  afterAll(() => {
    loggerErrorSpy?.mockRestore()
  })

  describe('when the token is for a valid user', () => {
    test('returns a valid policy', async () => {
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

  describe('when the profile returned is invalid', () => {
    test('returns a deny policy when the profile is missing a uid', async () => {
      fetchEdlProfile.mockResolvedValueOnce(false)

      const event = {
        methodArn: 'arn:aws:execute-api:us-east-1:123:api-id/stage/GET/resource'
      }

      const response = await edlAuthorizer(event, {})

      expect(response).toEqual({
        principalId: 'user',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Deny',
              Resource: event.methodArn
            }
          ]
        }
      })

      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith('Authorization failed: No uid found in profile')
    })
  })

  describe('when the supplied token is invalid', () => {
    test('returns a deny policy when fetchEdlProfile throws unauthorized error', async () => {
      const unauthorizedError = new Error('Unauthorized')
      fetchEdlProfile.mockRejectedValueOnce(unauthorizedError)

      const event = {
        methodArn: 'arn:aws:execute-api:us-east-1:123:api-id/stage/POST/resource'
      }

      const response = await edlAuthorizer(event, {})

      expect(response).toEqual({
        principalId: 'user',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Deny',
              Resource: event.methodArn
            }
          ]
        }
      })

      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith('EDL Authorizer error:', unauthorizedError)
    })
  })

  describe('when the assurance level is below requirements', () => {
    test('returns a deny policy when below 5', async () => {
      fetchEdlProfile.mockResolvedValueOnce({
        uid: 'mock_user',
        assuranceLevel: 3
      })

      const event = {
        methodArn: 'arn:aws:execute-api:us-east-1:123:api-id/stage/PUT/resource'
      }

      const response = await edlAuthorizer(event, {})

      expect(response).toEqual({
        principalId: 'user',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Deny',
              Resource: event.methodArn
            }
          ]
        }
      })

      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith('Authorization failed: Assurance level 3 below required 5')
    })

    test('returns a deny policy when assurance level missing', async () => {
      fetchEdlProfile.mockResolvedValueOnce({
        uid: 'mock_user'
      })

      const event = {
        methodArn: 'arn:aws:execute-api:us-east-1:123:api-id/stage/DELETE/resource'
      }

      const response = await edlAuthorizer(event, {})

      expect(response).toEqual({
        principalId: 'user',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Deny',
              Resource: event.methodArn
            }
          ]
        }
      })

      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith('Authorization failed: Assurance level missing from profile')
    })
  })
})
