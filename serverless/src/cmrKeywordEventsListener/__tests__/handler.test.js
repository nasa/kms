import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'

import { cmrKeywordEventsListener } from '../handler'

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

describe('when the CMR keyword events processor is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when the invocation is successful', () => {
    describe('when the queue record contains a valid SNS notification', () => {
      test('should log the parsed keyword event and acknowledge the batch', async () => {
        const result = await cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  event_type: 'keyword_updated',
                  uuid: '1234'
                })
              })
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          'Received keyword event for CMR listener',
          expect.objectContaining({
            keywordEvent: expect.objectContaining({
              event_type: 'keyword_updated'
            })
          })
        )

        expect(result).toEqual({
          batchItemFailures: []
        })
      })
    })

    describe('when the SNS notification does not include a message payload', () => {
      test('should log a null keyword event and acknowledge the batch', async () => {
        const result = await cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-456',
              body: JSON.stringify({
                Type: 'Notification'
              })
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          'Received keyword event for CMR listener',
          expect.objectContaining({
            keywordEvent: null
          })
        )

        expect(result).toEqual({
          batchItemFailures: []
        })
      })
    })

    describe('when the queue record body is missing', () => {
      test('should treat the payload as an empty SNS envelope and acknowledge the batch', async () => {
        const result = await cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-789'
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          'Received keyword event for CMR listener',
          expect.objectContaining({
            keywordEvent: null
          })
        )

        expect(result).toEqual({
          batchItemFailures: []
        })
      })
    })
  })

  describe('when the invocation is unsuccessful', () => {
    describe('when there are no queue records', () => {
      test('should acknowledge the empty batch', async () => {
        await expect(cmrKeywordEventsListener()).resolves.toEqual({
          batchItemFailures: []
        })
      })
    })

    describe('when the queue record cannot be parsed', () => {
      test('should log the error and throw', async () => {
        await expect(cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: 'not-json'
            }
          ]
        })).rejects.toThrow()

        expect(logger.error).toHaveBeenCalled()
      })
    })
  })
})
