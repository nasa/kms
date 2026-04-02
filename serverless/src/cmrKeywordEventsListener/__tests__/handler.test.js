import {
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrKeywordEventsListener } from '../handler'

describe('when the CMR keyword events processor is invoked', () => {
  describe('when the invocation is successful', () => {
    describe('when the queue record contains a valid SNS notification', () => {
      test('should log the parsed keyword event and acknowledge the batch', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

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

        expect(logSpy).toHaveBeenCalledWith(
          'Received keyword event for CMR listener',
          expect.stringContaining('"event_type":"keyword_updated"')
        )

        expect(result).toEqual({
          batchItemFailures: []
        })

        logSpy.mockRestore()
      })
    })

    describe('when the SNS notification does not include a message payload', () => {
      test('should log a null keyword event and acknowledge the batch', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

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

        expect(logSpy).toHaveBeenCalledWith(
          'Received keyword event for CMR listener',
          expect.stringContaining('"keywordEvent":null')
        )

        expect(result).toEqual({
          batchItemFailures: []
        })

        logSpy.mockRestore()
      })
    })

    describe('when the queue record body is missing', () => {
      test('should treat the payload as an empty SNS envelope and acknowledge the batch', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const result = await cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-789'
            }
          ]
        })

        expect(logSpy).toHaveBeenCalledWith(
          'Received keyword event for CMR listener',
          expect.stringContaining('"keywordEvent":null')
        )

        expect(result).toEqual({
          batchItemFailures: []
        })

        logSpy.mockRestore()
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
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: 'not-json'
            }
          ]
        })).rejects.toThrow()

        expect(errorSpy).toHaveBeenCalled()

        errorSpy.mockRestore()
      })
    })
  })
})
