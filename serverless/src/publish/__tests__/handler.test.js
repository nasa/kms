import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { mockClient } from 'aws-sdk-client-mock'
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

const eventBridgeMock = mockClient(EventBridgeClient)

// Mock the imported functions
vi.mock('@/shared/getConfig')

describe('publish handler', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    eventBridgeMock.reset()
    getApplicationConfig.mockReturnValue({ defaultResponseHeaders: {} })
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.spyOn(logger, 'info').mockImplementation(() => {})
  })

  describe('when successful', () => {
    test('should successfully initiate publish process', async () => {
      // 5. Use the mock to set behavior
      eventBridgeMock.on(PutEventsCommand).resolves({ FailedEntryCount: 0 })

      const event = { queryStringParameters: { name: 'v1.0.0' } }
      const result = await publish(event)

      expect(result.statusCode).toBe(202)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Publish process initiated for version v1.0.0')
      expect(body.version).toBe('v1.0.0')
      expect(body.publishDate).toBeDefined()

      // Should emit EventBridge event
      expect(eventBridgeMock.commandCalls(PutEventsCommand).length).toBe(1)
      const sentCommand = eventBridgeMock.commandCalls(PutEventsCommand)[0].args[0]
      expect(sentCommand.input).toEqual(
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

      eventBridgeMock.on(PutEventsCommand).rejects(new Error('EventBridge error'))

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toBe('EventBridge error')
      expect(logger.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })

    test('should handle EventBridge failed entries', async () => {
      const event = { queryStringParameters: { name: 'v1.0.0' } }

      // Replace sendEventBridgeMock.mockResolvedValue with eventBridgeMock.on().resolves()
      eventBridgeMock.on(PutEventsCommand).resolves({ FailedEntryCount: 1 })

      const result = await publish(event)

      expect(result.statusCode).toBe(500)
      const body = JSON.parse(result.body)
      expect(body.message).toBe('Error in publish process')
      expect(body.error).toContain('Failed to emit publish event')
      expect(logger.error).toHaveBeenCalledWith('Error in publish process:', expect.any(Error))
    })
  })
})
