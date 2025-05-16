import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { publish } from '../handler'

// Mock the imported functions
vi.mock('@/shared/getConfig')
vi.mock('@/shared/getVersionMetadata')
vi.mock('@/shared/getVersionNames')
vi.mock('@/shared/operations/updates/getPublishUpdateQuery')
vi.mock('@/shared/sparqlRequest')

describe('publish handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    sparqlRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          bindings: [
            { versionName: { value: 'existing_version' } },
            { versionName: { value: 'other_version' } }
          ]
        }
      })
    })
  })

  describe('when successful', () => {
    test('should successfully initiate the publish process for a new version', async () => {
      const event = { queryStringParameters: { name: 'new_version' } }
      getVersionMetadata.mockResolvedValue({ versionName: 'old_version' })
      getPublishUpdateQuery.mockReturnValue('mock query')

      const result = await publish(event)

      expect(result.statusCode).toBe(202)
      expect(JSON.parse(result.body).message).toBe('Publish process initiated for version new_version')
      expect(getPublishUpdateQuery).toHaveBeenCalledWith('new_version', expect.any(String), { versionName: 'old_version' })
      expect(sparqlRequest).toHaveBeenCalledTimes(2)
      expect(sparqlRequest).toHaveBeenNthCalledWith(1, {
        method: 'POST',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        body: expect.any(String)
      })

      expect(sparqlRequest).toHaveBeenNthCalledWith(2, {
        method: 'POST',
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        body: 'mock query'
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should return a 400 error when name is not provided', async () => {
      const event = {}
      const result = await publish(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
    })

    test('should return a 400 error when the version name already exists', async () => {
      const event = { queryStringParameters: { name: 'existing_version' } }

      const result = await publish(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).message).toBe('Error: Version name "existing_version" already exists')
      expect(getPublishUpdateQuery).not.toHaveBeenCalled()
      expect(sparqlRequest).toHaveBeenCalledTimes(1) // Called once for getVersionNames
    })

    test('should handle errors during the publish process setup', async () => {
      const event = { queryStringParameters: { name: 'new_version' } }
      getVersionMetadata.mockRejectedValue(new Error('Database error'))

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body).message).toBe('Error in initiating publish process')
      expect(JSON.parse(result.body).error).toBe('Database error')
      expect(console.error).toHaveBeenCalledWith('Error in publish process setup:', expect.any(Error))
      expect(getPublishUpdateQuery).not.toHaveBeenCalled()
      expect(sparqlRequest).not.toHaveBeenCalledTimes(2)
    })

    test('should handle errors during the SPARQL request', async () => {
      const event = { queryStringParameters: { name: 'new_version' } }
      getVersionMetadata.mockResolvedValue({ versionName: 'old_version' })
      getPublishUpdateQuery.mockReturnValue('mock query')

      // Mock the first sparqlRequest call (for getVersionNames) to succeed
      sparqlRequest.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: {
            bindings: [
              { versionName: { value: 'existing_version' } },
              { versionName: { value: 'other_version' } }
            ]
          }
        })
      })

      // Mock the second sparqlRequest call (for the actual publish operation) to fail
      sparqlRequest.mockResolvedValueOnce(Promise.reject(new Error('SPARQL request failed')))

      const result = await publish(event)

      // The publish function should still return a 202 status
      expect(result.statusCode).toBe(202)
      expect(JSON.parse(result.body).message).toBe('Publish process initiated for version new_version')

      // Use setImmediate to allow the asynchronous error handling to occur
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setImmediate(resolve))

      expect(console.error).toHaveBeenCalledWith('Error in asynchronous publish process:', expect.any(Error))
      expect(sparqlRequest).toHaveBeenCalledTimes(2)
    })
  })
})
