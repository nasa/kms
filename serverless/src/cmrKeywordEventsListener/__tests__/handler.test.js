import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'

import { cmrKeywordEventsListener } from '../handler'

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/shared/publishMetadataCorrectionRequest', () => ({
  publishMetadataCorrectionRequest: vi.fn()
}))

describe('when the CMR keyword events processor is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publishMetadataCorrectionRequest).mockResolvedValue({
      messageId: 'metadata-correction-message-123',
      message: '{}',
      topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo'
    })
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
                  EventType: 'UPDATED',
                  Scheme: 'sciencekeywords',
                  UUID: '1234',
                  OldKeywordPath: 'Old > Keyword',
                  NewKeywordPath: 'New > Keyword',
                  Timestamp: '2026-04-21T00:00:00.000Z'
                })
              })
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          '[consumer] Received keyword event for CMR listener',
          expect.objectContaining({
            messageId: 'message-123',
            keywordEvent: expect.objectContaining({
              EventType: 'UPDATED',
              UUID: '1234'
            })
          })
        )

        expect(publishMetadataCorrectionRequest).toHaveBeenCalledWith({
          source: 'cmrKeywordEventsListener',
          collectionConceptId: 'C0000000000-KMS',
          keywordEvent: {
            eventType: 'UPDATED',
            scheme: 'sciencekeywords',
            uuid: '1234',
            oldKeywordPath: 'Old > Keyword',
            newKeywordPath: 'New > Keyword',
            timestamp: '2026-04-21T00:00:00.000Z'
          }
        })

        expect(logger.info).toHaveBeenCalledWith(
          '[consumer] Published metadata correction request',
          expect.objectContaining({
            collectionConceptId: 'C0000000000-KMS',
            messageId: 'metadata-correction-message-123'
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
          '[consumer] Received keyword event for CMR listener',
          expect.objectContaining({
            messageId: 'message-456',
            keywordEvent: null
          })
        )

        expect(result).toEqual({
          batchItemFailures: []
        })

        expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
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
          '[consumer] Received keyword event for CMR listener',
          expect.objectContaining({
            messageId: 'message-789',
            keywordEvent: null
          })
        )

        expect(result).toEqual({
          batchItemFailures: []
        })

        expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
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

    describe('when publishing the metadata correction request fails', () => {
      test('should log the error and throw', async () => {
        vi.mocked(publishMetadataCorrectionRequest).mockRejectedValue(new Error('SNS unavailable'))

        await expect(cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'UPDATED',
                  UUID: '1234'
                })
              })
            }
          ]
        })).rejects.toThrow('SNS unavailable')

        expect(logger.error).toHaveBeenCalled()
      })
    })
  })
})
