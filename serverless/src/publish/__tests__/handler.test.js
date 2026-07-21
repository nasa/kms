import { EventBridgeClient } from '@aws-sdk/client-eventbridge'
import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getApplicationConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'

import { publish } from '../handler'

// 1. Use a regular function for the mock constructor
vi.mock('@aws-sdk/client-eventbridge', () => {
  const mSend = vi.fn()
  function MockEventBridgeClient() {
    return {
      send: mSend
    }
  }

  return {
    EventBridgeClient: MockEventBridgeClient,
    PutEventsCommand: vi.fn((input) => input)
  }
})

// Mock the other imported functions
vi.mock('@/shared/getConfig')

describe('publish handler', () => {
  let mockSend

  beforeEach(async () => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})

    const clientInstance = new EventBridgeClient()
    mockSend = clientInstance.send
  })

  describe('when successful', () => {
    test('should successfully initiate publish process', async () => {
      mockSend.mockResolvedValueOnce({ FailedEntryCount: 0 })

      const event = { queryStringParameters: { name: 'v1.0.0' } }

      const result = await publish(event)

      expect(result.statusCode).toBe(202)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Publish process initiated for version v1.0.0')
      expect(body.version).toBe('v1.0.0')
      expect(body.publishDate).toBeDefined()

      // Should emit EventBridge event via send()
      expect(mockSend).toHaveBeenCalledTimes(1)
      const sentCommandInput = mockSend.mock.calls[0][0]
      expect(sentCommandInput).toEqual(
        expect.objectContaining({
          Entries: expect.arrayContaining([
            expect.objectContaining({
              Source: 'kms.publish',
              DetailType: 'kms.published.version.changed',
              Detail: expect.stringContaining('v1.0.0')
            })
          ])
        })
      )

      expect(logger.info).toHaveBeenCalledWith('[publish] Initiated publish process for version=v1.0.0')
    })
  })

  describe('when unsuccessful', () => {
    test('should return a 400 error when name is not provided', async () => {
      const event = { queryStringParameters: {} }
      const result = await publish(event)

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.body).message).toContain('Error: "name" parameter is required')
    })

    test('should handle errors when emitting EventBridge event', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }

      mockSend.mockRejectedValueOnce(new Error('EventBridge error'))

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toBe('EventBridge error')
      expect(logger.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })

    test('should handle EventBridge failed entries', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }

      mockSend.mockResolvedValueOnce({ FailedEntryCount: 1 })

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toContain('Failed to emit publish event')
      expect(logger.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })
  })
})
