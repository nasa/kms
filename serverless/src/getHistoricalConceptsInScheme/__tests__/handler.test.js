import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'

import { getHistoricalConceptsInScheme } from '../handler'

// GetS3Client() is called once at module-load time in handler.js, so the
// mocked client needs to exist before the handler module is imported. Using
// vi.hoisted + a mock factory ensures `mockSend` is available when the
// `@/shared/awsClients` mock is set up, and lets us control its behavior
// per test via mockSend.mockResolvedValueOnce(...).
//
// handler.js also reads `RDF_BUCKET_NAME` at module-load time and throws if
// it's missing, so it must be set here too, before the static import of
// `../handler` below runs (vi.hoisted is lifted above all imports).
const { mockSend } = vi.hoisted(() => {
  process.env.RDF_BUCKET_NAME = 'test-bucket'

  return { mockSend: vi.fn() }
})

vi.mock('@/shared/awsClients', () => ({
  getS3Client: () => ({ send: mockSend })
}))

vi.mock('@/shared/getConfig')
vi.mock('@/shared/logAnalyticsData')

describe('getHistoricalConceptsInScheme', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock getApplicationConfig
    getApplicationConfig.mockReturnValue({
      defaultResponseHeaders: { 'X-Test': 'test-header' }
    })
  })

  describe('when validation errors occur', () => {
    test('should return 400 when conceptScheme path parameter is missing', async () => {
      const event = {
        pathParameters: {},
        queryStringParameters: { version: 'A' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(400)
      expect(response.headers['X-Test']).toBe('test-header')
      expect(JSON.parse(response.body)).toEqual({ error: 'scheme is required' })
      expect(mockSend).not.toHaveBeenCalled()
    })

    test('should return 400 when version query parameter is missing', async () => {
      const event = {
        pathParameters: { conceptScheme: 'ScienceKeywords' },
        queryStringParameters: {}
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body)).toEqual({ error: 'version is required' })
      expect(mockSend).not.toHaveBeenCalled()
    })

    test('should return 400 when pathParameters and queryStringParameters are absent entirely', async () => {
      const response = await getHistoricalConceptsInScheme({}, {})

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body)).toEqual({ error: 'scheme is required' })
    })

    test('should return 400 when conceptScheme contains invalid characters', async () => {
      const event = {
        pathParameters: { conceptScheme: 'instruments"; DROP TABLE--' },
        queryStringParameters: { version: 'A' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body)).toEqual({ error: 'scheme contains invalid characters' })
      expect(mockSend).not.toHaveBeenCalled()
    })

    test('should return 400 when version contains invalid characters', async () => {
      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: { version: 'A\r\nX-Injected: true' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body)).toEqual({ error: 'version contains invalid characters' })
      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('when successful', () => {
    test('should return 200 with the CSV content, matching the scheme case-insensitively', async () => {
      // First call: ListObjectsV2 under the version prefix
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'A/ScienceKeywords.csv' },
          { Key: 'A/instruments.csv' }
        ]
      })

      // Second call: GetObject for the matched key
      mockSend.mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve('id,label\n1,Foo\n2,Bar') }
      })

      const event = {
        pathParameters: { conceptScheme: 'sciencekeywords' },
        queryStringParameters: { version: 'A' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(200)
      expect(response.headers['Content-Type']).toBe('text/csv; charset=utf-8')
      expect(response.headers['Content-Disposition']).toBe('attachment; filename="sciencekeywords.csv"')
      expect(response.headers['X-Test']).toBe('test-header')
      expect(response.body).toBe('id,label\n1,Foo\n2,Bar')

      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    test('should paginate through multiple pages when listing keys', async () => {
      mockSend
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/other.csv' }],
          NextContinuationToken: 'page-2-token'
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/instruments.csv' }]
        })
        .mockResolvedValueOnce({
          Body: { transformToString: () => Promise.resolve('id,label\n1,Sensor') }
        })

      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: { version: 'A' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('id,label\n1,Sensor')
      expect(mockSend).toHaveBeenCalledTimes(3)
    })

    test('should call logAnalyticsData with the event and context', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'A/instruments.csv' }]
      })

      mockSend.mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve('id,label') }
      })

      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: { version: 'A' }
      }
      const context = { some: 'context' }
      await getHistoricalConceptsInScheme(event, context)

      expect(logAnalyticsData).toHaveBeenCalledWith({
        event,
        context
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should return 404 when no CSV matches the requested scheme', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'A/instruments.csv' }]
      })

      const event = {
        pathParameters: { conceptScheme: 'doesnotexist' },
        queryStringParameters: { version: 'A' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(404)
      expect(JSON.parse(response.body)).toEqual({
        error: 'No concept scheme doesnotexist found for version A'
      })

      // Only the list call should happen, never a GetObject
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    test('should return 404 when the version prefix has no objects at all', async () => {
      mockSend.mockResolvedValueOnce({})

      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: { version: 'unknown-version' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(404)
    })

    test('should return 500 when listing objects fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('The specified bucket does not exist'))

      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: { version: 'A' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'Failed to fetch concept scheme CSV' })
    })

    test('should return 500 when downloading the matched object fails', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'A/instruments.csv' }]
      })

      mockSend.mockRejectedValueOnce(new Error('Access denied'))

      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: { version: 'A' }
      }
      const response = await getHistoricalConceptsInScheme(event, {})

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'Failed to fetch concept scheme CSV' })
    })

    test('should log the error to the console', async () => {
      const error = new Error('Access denied')
      mockSend.mockRejectedValueOnce(error)

      const event = {
        pathParameters: { conceptScheme: 'instruments' },
        queryStringParameters: { version: 'A' }
      }
      await getHistoricalConceptsInScheme(event, {})

      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledWith(
        'Failed to download CSV for scheme=instruments, version=A: Access denied'
      )
    })
  })

  describe('when RDF_BUCKET_NAME is not set', () => {
    test('should throw a clear error at module load instead of silently falling back to a default bucket', async () => {
      const originalValue = process.env.RDF_BUCKET_NAME
      delete process.env.RDF_BUCKET_NAME

      vi.resetModules()

      await expect(import('../handler')).rejects.toThrow(
        'Missing required environment variable: RDF_BUCKET_NAME'
      )

      process.env.RDF_BUCKET_NAME = originalValue
    })
  })
})
