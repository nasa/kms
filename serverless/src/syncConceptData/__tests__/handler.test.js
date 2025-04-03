import fetch from 'node-fetch'
import {
  beforeEach,
  describe,
  expect,
  vi
} from 'vitest'

import { importConceptData } from '@/shared/importConceptData'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'

import syncConceptData from '../handler'

vi.mock('@/shared/importConceptData', () => ({
  importConceptData: vi.fn()
}))

vi.mock('@/shared/updateVersionMetadata', () => ({
  updateVersionMetadata: vi.fn()
}))

vi.mock('node-fetch', () => ({
  default: vi.fn()
}))

// Mock the https module
vi.mock('https', () => ({
  default: {
    Agent: vi.fn(() => ({}))
  }
}))

describe('syncConceptData', () => {
  let consoleErrorSpy
  let consoleLogSpy

  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('SHOULD_SYNC', 'true')
    vi.stubEnv('SYNC_API_ENDPOINT', 'http://api.example.com')

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Mock successful responses
    fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('mockData')
    })

    vi.mocked(importConceptData).mockResolvedValue(undefined)
    vi.mocked(updateVersionMetadata).mockResolvedValue(undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  describe('when successful', () => {
    test('should complete sync process from HTTP event and update lastSynced', async () => {
      const event = {
        body: {
          version: 'v1'
        }
      }

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process complete.' })
      expect(updateVersionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        graphId: 'v1',
        lastSynced: expect.any(String)
      }))
    })

    test('should complete sync process from scheduled event and update lastSynced', async () => {
      const event = {
        version: 'published'
      }

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process complete.' })
      expect(updateVersionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        graphId: 'published',
        lastSynced: expect.any(String)
      }))
    })

    test('should return a message when sync is disabled', async () => {
      vi.stubEnv('SHOULD_SYNC', 'false')
      const event = {
        body: {
          version: 'v1'
        }
      }
      const response = await syncConceptData(event)
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync is disabled' })
    })

    test('should call importConceptData, and updateVersionMetadata', async () => {
      const event = {
        body: {
          version: 'draft'
        }
      }
      const mockJsonContent = '{"data": "json"}'

      fetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockJsonContent)
        })

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process complete.' })
      expect(fetch).toHaveBeenCalledWith(
        'http://api.example.com/kms/concepts_to_rdf_repo?format=json&version=draft',
        expect.anything()
      )

      expect(importConceptData).toHaveBeenCalledWith(mockJsonContent, 'draft', 'draft')
      expect(updateVersionMetadata).toHaveBeenCalledWith(expect.objectContaining({
        graphId: 'draft',
        lastSynced: expect.any(String)
      }))

      expect(consoleLogSpy).toHaveBeenCalledWith('Concept data synchronized successfully')
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Updated lastSynced date to'))
    })
  })

  describe('when unsuccessful', () => {
    test('should return an error when SYNC_API_ENDPOINT is not set', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('SHOULD_SYNC', 'true')
      const event = {
        body: {
          version: 'v1'
        }
      }
      const response = await syncConceptData(event)
      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'SYNC_API_ENDPOINT environment variable is not set' })
    })

    test('should handle errors during sync process', async () => {
      const event = {
        body: {
          version: 'v1'
        }
      }

      fetch.mockRejectedValueOnce(new Error('Fetch failed'))

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'Fetch failed' })
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error syncing concept data:', expect.any(Error))
    })

    test('should throw an error when version is empty', async () => {
      const event = {
        body: {
          version: ''
        }
      }

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Invalid parameters: version must not be empty'
      })
    })

    test('should handle HTTP errors from fetch', async () => {
      const event = {
        body: {
          version: 'v1'
        }
      }

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({
        error: 'HTTP error! status: 404'
      })
    })

    test('should handle network errors', async () => {
      const event = {
        body: {
          version: 'v1'
        }
      }

      fetch.mockRejectedValueOnce(new Error('Network error'))

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Network error'
      })
    })

    test('should throw an error when both event.body and event.version are missing', async () => {
      const event = {}
      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Missing required parameters: version'
      })
    })
  })
})
