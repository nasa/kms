import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getCmrCollectionConceptIds } from '@/shared/getCmrCollectionConceptIds'
import { logger } from '@/shared/logger'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'

import { cmrKeywordEventsListener } from '../handler'

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/shared/getCmrCollectionConceptIds', () => ({
  getCmrCollectionConceptIds: vi.fn()
}))

vi.mock('@/shared/publishMetadataCorrectionRequest', () => ({
  publishMetadataCorrectionRequest: vi.fn()
}))

describe('when the CMR keyword events processor is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCmrCollectionConceptIds).mockResolvedValue([
      'C1000000000-PROV',
      'C2000000000-PROV'
    ])

    vi.mocked(publishMetadataCorrectionRequest).mockResolvedValue({
      messageId: 'metadata-correction-message-123',
      message: '{}',
      topicArn: 'arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo'
    })
  })

  describe('when the invocation is successful', () => {
    describe('when the queue record contains a valid SNS notification', () => {
      test('should discover collection concept ids, publish one request per concept id, and acknowledge the batch', async () => {
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

        expect(getCmrCollectionConceptIds).toHaveBeenCalledWith({
          scheme: 'sciencekeywords',
          uuid: '1234'
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(
            '[consumer] Received keyword event for CMR listener '
          )
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('messageId=message-123')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('eventType=UPDATED')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('scheme=sciencekeywords')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('uuid=1234')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('[consumer] Found collection concept ids for metadata correction ')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('count=2')
        )

        expect(publishMetadataCorrectionRequest).toHaveBeenNthCalledWith(1, {
          source: 'cmrKeywordEventsListener',
          collectionConceptId: 'C1000000000-PROV',
          keywordEvent: {
            eventType: 'UPDATED',
            scheme: 'sciencekeywords',
            uuid: '1234',
            oldKeywordPath: 'Old > Keyword',
            newKeywordPath: 'New > Keyword',
            timestamp: '2026-04-21T00:00:00.000Z'
          }
        })

        expect(publishMetadataCorrectionRequest).toHaveBeenNthCalledWith(2, {
          source: 'cmrKeywordEventsListener',
          collectionConceptId: 'C2000000000-PROV',
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
          expect.stringContaining('[consumer] Published metadata correction request ')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('collectionConceptId=C1000000000-PROV')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('messageId=metadata-correction-message-123')
        )

        expect(result).toEqual({
          batchItemFailures: []
        })
      })

      test('should skip publish when no affected collection concept ids are found', async () => {
        vi.mocked(getCmrCollectionConceptIds).mockResolvedValue([])

        const result = await cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'UPDATED',
                  Scheme: 'sciencekeywords',
                  UUID: '1234'
                })
              })
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('[consumer] No affected collection concept ids found for keyword event ')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('scheme=sciencekeywords')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('uuid=1234')
        )

        expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
        expect(result).toEqual({
          batchItemFailures: []
        })
      })

      test('should skip concept-id lookup for inserted keyword events', async () => {
        const result = await cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'INSERTED',
                  Scheme: 'sciencekeywords',
                  UUID: '1234',
                  NewKeywordPath: 'New > Keyword'
                })
              })
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('[consumer] Skipping metadata correction concept-id lookup for event type ')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('eventType=INSERTED')
        )

        expect(getCmrCollectionConceptIds).not.toHaveBeenCalled()
        expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
        expect(result).toEqual({
          batchItemFailures: []
        })
      })

      test('should log n/a publish metadata when the publish helper omits optional fields', async () => {
        vi.mocked(getCmrCollectionConceptIds).mockResolvedValue(['C1000000000-PROV'])
        vi.mocked(publishMetadataCorrectionRequest).mockResolvedValue({})

        await cmrKeywordEventsListener({
          Records: [
            {
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'UPDATED',
                  Scheme: 'sciencekeywords',
                  UUID: '1234'
                })
              })
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('messageId=n/a')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('topicArn=n/a')
        )
      })

      test('should log n/a event details when a keyword event body is present but empty', async () => {
        const result = await cmrKeywordEventsListener({
          Records: [
            {
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({})
              })
            }
          ]
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('eventType=n/a')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('scheme=n/a')
        )

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('uuid=n/a')
        )

        expect(getCmrCollectionConceptIds).not.toHaveBeenCalled()
        expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
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
          expect.stringContaining('messageId=message-456')
        )

        expect(result).toEqual({
          batchItemFailures: []
        })

        expect(getCmrCollectionConceptIds).not.toHaveBeenCalled()
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
          expect.stringContaining('messageId=message-789')
        )

        expect(result).toEqual({
          batchItemFailures: []
        })

        expect(getCmrCollectionConceptIds).not.toHaveBeenCalled()
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

    describe('when concept-id lookup fails', () => {
      test('should log the error and throw', async () => {
        vi.mocked(getCmrCollectionConceptIds).mockRejectedValue(new Error('CMR unavailable'))

        await expect(cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'UPDATED',
                  Scheme: 'sciencekeywords',
                  UUID: '1234'
                })
              })
            }
          ]
        })).rejects.toThrow('CMR unavailable')

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
