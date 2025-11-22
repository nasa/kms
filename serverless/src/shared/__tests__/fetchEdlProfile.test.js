import fetchEdlClientToken from '../fetchEdlClientToken'
import fetchEdlProfile from '../fetchEdlProfile'

vi.mock('../fetchEdlClientToken', () => ({ default: vi.fn() }))

const originalConsoleLog = console.log

beforeEach(() => {
  vi.resetAllMocks()
  console.log = vi.fn()
  fetchEdlClientToken.mockImplementation(() => ('mock_token'))
})

afterEach(() => {
  vi.clearAllMocks()
  console.log = originalConsoleLog
})

describe('fetchEdlProfile', () => {
  describe('when provided a Bearer access token', () => {
    describe('when the token is valid', () => {
      test('calls the oauth endpoint and returns the profile', async () => {
        global.fetch = vi.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            nams_auid: 'user.name',
            uid: 'user.name',
            first_name: 'User',
            last_name: 'Name',
            assurance_level: 3
          })
        }))

        const profile = await fetchEdlProfile('Bearer bearer-token-value')

        expect(profile).toEqual({
          auid: 'user.name',
          assuranceLevel: 3,
          name: 'User Name',
          uid: 'user.name'
        })

        expect(fetchEdlClientToken).not.toHaveBeenCalled()
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith('https://sit.urs.earthdata.nasa.gov/oauth/userInfo', {
          headers: {
            Authorization: 'Bearer bearer-token-value',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          method: 'GET'
        })
      })
    })

    describe('when the oauth endpoint returns an error', () => {
      test('throws an error describing the failure', async () => {
        global.fetch = vi.fn(() => Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Unauthorized' })
        }))

        await expect(fetchEdlProfile('Bearer bearer-token-value')).rejects.toThrow('EDL oauth request failed with status 401')
        expect(fetchEdlClientToken).not.toHaveBeenCalled()
      })
    })

    describe('when the Bearer token value is missing', () => {
      test('throws an invalid token error without calling fetch', async () => {
        global.fetch = vi.fn()

        await expect(fetchEdlProfile('Bearer    ')).rejects.toThrow('Invalid Bearer token provided')
        expect(fetch).not.toHaveBeenCalled()
        expect(fetchEdlClientToken).not.toHaveBeenCalled()
      })
    })
  })

  describe('when provided a Launchpad access token', () => {
    describe('when the user exists', () => {
      test('returns the users profile', async () => {
        global.fetch = vi.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            nams_auid: 'user.name',
            uid: 'user.name',
            first_name: 'User',
            last_name: 'Name'
          })
        }))

        const profile = await fetchEdlProfile('mock-token')

        expect(profile).toEqual({
          auid: 'user.name',
          assuranceLevel: 5,
          uid: 'user.name',
          name: 'User Name'
        })

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith('https://sit.urs.earthdata.nasa.gov/api/nams/edl_user', {
          body: 'token=mock-token',
          headers: {
            Authorization: 'Bearer mock_token',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          method: 'POST'
        })
      })
    })

    describe('when the user does not have name fields', () => {
      test('returns the users profile', async () => {
        global.fetch = vi.fn(() => Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            nams_auid: 'user.name',
            uid: 'user.name',
            first_name: undefined,
            last_name: undefined
          })
        }))

        const profile = await fetchEdlProfile('mock-token')

        expect(profile).toEqual({
          auid: 'user.name',
          assuranceLevel: 5,
          uid: 'user.name',
          name: 'user.name'
        })

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith('https://sit.urs.earthdata.nasa.gov/api/nams/edl_user', {
          body: 'token=mock-token',
          headers: {
            Authorization: 'Bearer mock_token',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          method: 'POST'
        })
      })
    })

    describe('when the response from EDL is not ok', () => {
      test('throws an error', async () => {
        global.fetch = vi.fn(() => Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'Bad Request' })
        }))

        await expect(fetchEdlProfile('mock-token')).rejects.toThrow('EDL API request failed with status 400')
      })
    })
  })

  describe('when provided a mock token', () => {
    test('returns the offline profile', async () => {
      process.env.IS_OFFLINE = true
      const profile = await fetchEdlProfile('ABC-1')

      expect(profile).toEqual({
        auid: 'admin',
        assuranceLevel: 5,
        name: 'Admin User',
        uid: 'admin'
      })

      expect(fetch).toHaveBeenCalledTimes(0)
      process.env.IS_OFFLINE = false
    })
  })
})
