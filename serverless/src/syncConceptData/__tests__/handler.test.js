import {
  beforeEach,
  describe,
  expect,
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
    test('should initiate sync process from HTTP event', async () => {
      const event = {
        body: {
          version: 'v1'
        }
      }

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(202)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process initiated' })
    })

    test('should initiate sync process from scheduled event', async () => {
      const event = {
        version: 'published'
      }

      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(202)
      expect(JSON.parse(response.body)).toEqual({ message: 'Sync process initiated' })
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

    test('should call fetchPagedConceptData and importConceptData', async () => {
      const event = {
        body: {
          version: 'draft'
        }
      }
      const mockJsonContent = '{"data": "json"}'
      const mockXmlContent = '<data>xml</data>'

      vi.mocked(fetchPagedConceptData).mockResolvedValueOnce(mockJsonContent)
      vi.mocked(fetchPagedConceptData).mockResolvedValueOnce(mockXmlContent)

      await syncConceptData(event)

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(fetchPagedConceptData).toHaveBeenCalledWith('json', 'http://api.example.com', 'draft')
      expect(fetchPagedConceptData).toHaveBeenCalledWith('xml', 'http://api.example.com', 'draft')
      expect(importConceptData).toHaveBeenCalledWith(mockJsonContent, mockXmlContent, 'draft', 'draft')
      expect(consoleLogSpy).toHaveBeenCalledWith('Concept data synchronized successfully')
    })

    test('should log "Error in sync process" when syncProcess fails', async () => {
      const event = {
        body: {
          version: 'v1'
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

    test('should return an error when required parameters are missing in HTTP event', async () => {
      const event = { body: { } }
      const response = await syncConceptData(event)
      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'Invalid parameters: version must not be empty' })
    })

    test('should log error when sync process fails', async () => {
      const event = {
        body: {
          version: 'published'
        }
      }
      const mockError = new Error('Fetch error')
      vi.mocked(fetchPagedConceptData).mockRejectedValueOnce(mockError)

      await syncConceptData(event)

      // Run all pending timers and microtasks
      await vi.runAllTimersAsync()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in sync process:', mockError)
    })

    test('should return an error when both event.body and event.version are missing', async () => {
      const event = {}
      const response = await syncConceptData(event)

      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: 'Missing required parameters: version' })
    })

    test('should log errors that occur during the sync process', async () => {
      const event = {
        body: {
          version: 'v1'
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
