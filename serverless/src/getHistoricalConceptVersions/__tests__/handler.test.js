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
//
// handler.js also now reads `RDF_BUCKET_NAME` at module-load time and throws
// if it's missing, so it must be set here too, before the static import of
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
    test('should return 200 with the list of version directories that contain a CSV', async () => {
      mockSend
        // Top-level listing: two candidate version prefixes
        .mockResolvedValueOnce({
          CommonPrefixes: [
            { Prefix: 'A/' },
            { Prefix: 'B/' }
          ]
        })
        // Per-version CSV check for "A"
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/ScienceKeywords.csv' }]
        })
        // Per-version CSV check for "B"
        .mockResolvedValueOnce({
          Contents: [{ Key: 'B/ScienceKeywords.csv' }]
        })

      const event = {}
      const context = {}
      const response = await getHistoricalConceptVersions(event, context)

      expect(response.statusCode).toBe(200)
      expect(response.headers['X-Test']).toBe('test-header')
      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['A', 'B'] })
    })

    test('should exclude the draft directory', async () => {
      mockSend
        .mockResolvedValueOnce({
          CommonPrefixes: [
            { Prefix: 'draft/' },
            { Prefix: 'A/' }
          ]
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/ScienceKeywords.csv' }]
        })

      const response = await getHistoricalConceptVersions({}, {})

      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['A'] })
    })

    test('should exclude versions that have no CSV files, e.g. an rdf.xml-only or incomplete export', async () => {
      mockSend
        .mockResolvedValueOnce({
          CommonPrefixes: [
            { Prefix: 'A/' },
            { Prefix: 'B/' }
          ]
        })
        // "A" only has an rdf.xml export, no CSV
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/rdf.xml' }]
        })
        // "B" has a CSV
        .mockResolvedValueOnce({
          Contents: [{ Key: 'B/ScienceKeywords.csv' }]
        })

      const response = await getHistoricalConceptVersions({}, {})

      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['B'] })
    })

    test('should exclude a version whose prefix has no objects at all', async () => {
      mockSend
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'A/' }]
        })
        .mockResolvedValueOnce({})

      const response = await getHistoricalConceptVersions({}, {})

      expect(JSON.parse(response.body)).toEqual({ historicalVersions: [] })
    })

    test('should return an empty array when there are no common prefixes', async () => {
      mockSend.mockResolvedValueOnce({})

      const response = await getHistoricalConceptVersions({}, {})

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ historicalVersions: [] })
      // No candidate versions, so no per-version CSV checks should happen
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    test('should paginate through multiple pages of top-level results', async () => {
      mockSend
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'A/' }],
          NextContinuationToken: 'page-2-token'
        })
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'B/' }]
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/ScienceKeywords.csv' }]
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'B/ScienceKeywords.csv' }]
        })

      const response = await getHistoricalConceptVersions({}, {})

      expect(mockSend).toHaveBeenCalledTimes(4)
      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['A', 'B'] })
    })

    test('should paginate through multiple pages when checking a single version for CSVs', async () => {
      mockSend
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'A/' }]
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/rdf.xml' }],
          NextContinuationToken: 'version-page-2-token'
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'A/ScienceKeywords.csv' }]
        })

      const response = await getHistoricalConceptVersions({}, {})

      expect(mockSend).toHaveBeenCalledTimes(3)
      expect(JSON.parse(response.body)).toEqual({ historicalVersions: ['A'] })
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

    test('should return 500 when checking a version for CSVs fails', async () => {
      mockSend
        .mockResolvedValueOnce({
          CommonPrefixes: [{ Prefix: 'A/' }]
        })
        .mockRejectedValueOnce(new Error('Access denied'))

      const response = await getHistoricalConceptVersions({}, {})

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({
        message: 'Failed to fetch version directories'
      })
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
