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

const { sendEventBridgeMock, PutEventsCommandMock } = vi.hoisted(() => ({
  sendEventBridgeMock: vi.fn(),
  PutEventsCommandMock: vi.fn((input) => input)
}))

// Mock the imported functions
vi.mock('@/shared/getConfig')
vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(() => ({
    send: sendEventBridgeMock
  })),
  PutEventsCommand: PutEventsCommandMock
}))

describe('publish handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 0 })
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should successfully initiate publish process', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }

      const result = await publish(event)

      expect(result.statusCode).toBe(202)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Publish process initiated for version v1.0.0')
      expect(body.version).toBe('v1.0.0')
      expect(body.publishDate).toBeDefined()

      // Should emit EventBridge event
      expect(sendEventBridgeMock).toHaveBeenCalledTimes(1)
      expect(PutEventsCommandMock).toHaveBeenCalledWith(
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
      sendEventBridgeMock.mockRejectedValue(new Error('EventBridge error'))

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toBe('EventBridge error')
      expect(logger.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })

    test('should handle EventBridge failed entries', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }
      sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 1 })

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toContain('Failed to emit publish event')
      expect(logger.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })
  })
})
