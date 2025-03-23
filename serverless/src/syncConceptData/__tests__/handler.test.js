import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { fetchPagedConceptData } from '@/shared/fetchPagedConceptData'
import { importConceptData } from '@/shared/importConceptData'

import syncConceptData from '../handler'

vi.mock('@/shared/fetchPagedConceptData', () => ({
  fetchPagedConceptData: vi.fn()
}))

vi.mock('@/shared/importConceptData', () => ({
  importConceptData: vi.fn()
}))

describe('syncConceptData', () => {
  let consoleErrorSpy
  let consoleLogSpy

  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
    vi.useFakeTimers()
    vi.stubEnv('SHOULD_SYNC', 'true')
    vi.stubEnv('SYNC_API_ENDPOINT', 'http://api.example.com')

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  describe('when successful', () => {
    it('should initiate sync process from HTTP event', async () => {
      const event = {
        body: {
          version: 'v1',
          versionType: 'draft'
        }
      }

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(202)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process initiated' })
    })

    it('should initiate sync process from scheduled event', async () => {
      const event = {
        version: 'latest',
        versionType: 'published'
      }

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(202)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process initiated' })
    })

    it('should return a message when sync is disabled', async () => {
      vi.stubEnv('SHOULD_SYNC', 'false')
      const event = {
        body: {
          version: 'v1',
          versionType: 'draft'
        }
      }
      const response = await syncConceptData(event)
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync is disabled' })
    })

    it('should call fetchPagedConceptData and importConceptData', async () => {
      const event = {
        body: {
          version: 'v1',
          versionType: 'draft'
        }
      }
      const mockJsonContent = '{"data": "json"}'
      const mockXmlContent = '<data>xml</data>'

      vi.mocked(fetchPagedConceptData).mockResolvedValueOnce(mockJsonContent)
      vi.mocked(fetchPagedConceptData).mockResolvedValueOnce(mockXmlContent)

      await syncConceptData(event)

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(fetchPagedConceptData).toHaveBeenCalledWith('json', 'http://api.example.com', 'v1')
      expect(fetchPagedConceptData).toHaveBeenCalledWith('xml', 'http://api.example.com', 'v1')
      expect(importConceptData).toHaveBeenCalledWith(mockJsonContent, mockXmlContent, 'v1', 'draft')
      expect(consoleLogSpy).toHaveBeenCalledWith('Concept data synchronized successfully')
    })

    it('should log "Error in sync process" when syncProcess fails', async () => {
      const event = {
        body: {
          version: 'v1',
          versionType: 'draft'
        }
      }

      const mockError = new Error('Sync process failed')
      vi.mocked(fetchPagedConceptData).mockRejectedValueOnce(mockError)

      await syncConceptData(event)

      // Wait for the next tick to allow the asynchronous syncProcess to complete
      await new Promise(process.nextTick)

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      // Check for the error log within syncProcess
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in sync process:', mockError)

      // Check for the error log in the .catch() block
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in sync process:', mockError)
    })
  })

  describe('when unsuccessful', () => {
    it('should return an error when SYNC_API_ENDPOINT is not set', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('SHOULD_SYNC', 'true')
      const event = {
        body: {
          version: 'v1',
          versionType: 'draft'
        }
      }
      const response = await syncConceptData(event)
      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'SYNC_API_ENDPOINT environment variable is not set' })
    })

    it('should return an error when required parameters are missing in HTTP event', async () => {
      const event = { body: { version: 'v1' } }
      const response = await syncConceptData(event)
      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'Invalid parameters: version and versionType must not be empty' })
    })

    it('should log error when sync process fails', async () => {
      const event = {
        body: {
          version: 'v1',
          versionType: 'draft'
        }
      }
      const mockError = new Error('Fetch error')
      vi.mocked(fetchPagedConceptData).mockRejectedValueOnce(mockError)

      await syncConceptData(event)

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in sync process:', mockError)
    })

    it('should return an error when both event.body and event.version/versionType are missing', async () => {
      const event = {}
      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'Missing required parameters: version and versionType' })
    })

    it('should log errors that occur during the sync process', async () => {
      const event = {
        body: {
          version: 'v1',
          versionType: 'draft'
        }
      }

      const mockError = new Error('Sync process error')
      vi.mocked(fetchPagedConceptData).mockRejectedValueOnce(mockError)

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(202)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process initiated' })

      // Wait for the next tick to allow the asynchronous syncProcess to complete
      await new Promise(process.nextTick)

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in sync process:', mockError)
    })
  })
})
