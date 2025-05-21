import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { publish } from '../handler'

// Mock the imported functions
vi.mock('@/shared/getConfig')
vi.mock('@/shared/operations/updates/getPublishUpdateQuery')
vi.mock('@/shared/sparqlRequest')

describe('publish handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should successfully publish a new version', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }
      getPublishUpdateQuery.mockReturnValue('mock query')
      sparqlRequest.mockResolvedValue({ ok: true })

      const result = await publish(event)

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Publish process completed for version v1.0.0')
      expect(body.version).toBe('v1.0.0')
      expect(body.publishDate).toBeDefined()
      expect(getPublishUpdateQuery).toHaveBeenCalledWith('v1.0.0', expect.any(String))
      expect(sparqlRequest).toHaveBeenCalledWith({
        method: 'POST',
        contentType: 'application/sparql-update',
        accept: 'application/sparql-results+json',
        body: 'mock query'
      })
    })
  })

  describe('when unsuccessful', () => {
    test('should return a 400 error when name is not provided', async () => {
      const event = { queryStringParameters: {} }
      const result = await publish(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
    })

    test('should handle errors during the SPARQL request', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }
      getPublishUpdateQuery.mockReturnValue('mock query')
      sparqlRequest.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toBe('Failed to execute publish update: 500 Internal Server Error')
      expect(console.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })

    test('should handle unexpected errors', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }
      getPublishUpdateQuery.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toBe('Unexpected error')
      expect(console.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })
  })
})
