import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'

import { getHistoricalConceptVersions } from '../handler'

// `getS3Client()` is called once at module-load time in handler.js, so the
// mocked client needs to exist before the handler module is imported. Using
// vi.hoisted + a mock factory ensures `mockSend` is available when the
// `@/shared/awsClients` mock is set up, and lets us control its behavior
// per test via mockSend.mockResolvedValueOnce(...).
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn()
}))

vi.mock('@/shared/awsClients', () => ({
  getS3Client: () => ({ send: mockSend })
}))

vi.mock('@/shared/getConfig')
vi.mock('@/shared/logAnalyticsData')

describe('getHistoricalConceptVersions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock getApplicationConfig
    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'X-Test': 'test-header' }
    })
  })

  describe('when successful', () => {
    test('should return 200 with the list of version directories', async () => {
      mockSend.mockResolvedValueOnce({
        CommonPrefixes: [
          { Prefix: 'A/' },
          { Prefix: 'B/' }
        ]
      })

      const event = {}
      const context = {}
      const response = await getHistoricalConceptVersions(event, context)

      expect(response.statusCode).toBe(200)
      expect(response.headers['X-Test']).toBe('test-header')
      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['A', 'B'] })
    })

    test('should exclude the draft directory', async () => {
      mockSend.mockResolvedValueOnce({
        CommonPrefixes: [
          { Prefix: 'draft/' },
          { Prefix: 'A/' }
        ]
      })

      const response = await getHistoricalConceptVersions({}, {})

      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['A'] })
    })

    test('should return an empty array when there are no common prefixes', async () => {
      mockSend.mockResolvedValueOnce({})

      const response = await getHistoricalConceptVersions({}, {})

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ historicalVersions: [] })
    })

    test('should paginate through multiple pages of results', async () => {
      mockSend
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'A/' }],
          NextContinuationToken: 'page-2-token'
        })
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'B/' }]
        })

      const response = await getHistoricalConceptVersions({}, {})

      expect(mockSend).toHaveBeenCalledTimes(2)
      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['A', 'B'] })
    })

    test('should call logAnalyticsData with the event and context', async () => {
      mockSend.mockResolvedValueOnce({ CommonPrefixes: [] })

      const event = { some: 'event' }
      const context = { some: 'context' }
      await getHistoricalConceptVersions(event, context)

      expect(logAnalyticsData).toHaveBeenCalledWith({
        event,
        context
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should return 500 when the S3 request fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('The specified bucket does not exist'))

      const response = await getHistoricalConceptVersions({}, {})

      expect(response.statusCode).toBe(500)
      expect(response.headers['X-Test']).toBe('test-header')
      expect(JSON.parse(response.body)).toEqual({
        message: 'Failed to fetch version directories'
      })
    })

    test('should log the error to the console', async () => {
      const error = new Error('The specified bucket does not exist')
      mockSend.mockRejectedValueOnce(error)

      await getHistoricalConceptVersions({}, {})

      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledWith(
        'Failed to list S3 version directories:',
        error.message
      )
    })
  })
})
