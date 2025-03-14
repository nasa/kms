import fetchEdlProfile from '@/shared/fetchEdlProfile'

import edlAuthorizer from '../handler'

vi.mock('@/shared/fetchEdlProfile')

describe('edlAuthorizer', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    process.env = { ...OLD_ENV }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  describe('when the token is for a valid user', () => {
    test('returns a valid policy', async () => {
      fetchEdlProfile.mockImplementation(() => ({
        email: 'test.user@localhost',
        first_name: 'Test',
        last_name: 'User',
        uid: 'mock_user'
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
})
