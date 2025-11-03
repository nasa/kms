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

  describe('when the token is ABC-1', () => {
    test('returns the users profile', async () => {
      process.env.IS_OFFLINE = true
      const profile = await fetchEdlProfile('ABC-1')

      expect(profile).toEqual({
        auid: 'admin',
        name: 'Admin User',
        uid: 'admin'
      })

      expect(fetch).toHaveBeenCalledTimes(0)
      process.env.IS_OFFLINE = false
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
