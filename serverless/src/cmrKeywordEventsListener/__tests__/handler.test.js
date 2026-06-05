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

const OLD_SCIENCE_KEYWORD_OBJECT = {
  Category: 'Old',
  Topic: 'Keyword',
  Term: '',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const NEW_SCIENCE_KEYWORD_OBJECT = {
  Category: 'New',
  Topic: 'Keyword',
  Term: '',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const NEW_SCIENCE_KEYWORD_OBJECT_LOG = JSON.stringify(NEW_SCIENCE_KEYWORD_OBJECT)
const OLD_PROJECT_KEYWORD_OBJECT = {
  ShortName: 'Legacy Climate Study'
}
const OLD_PROJECT_KEYWORD_OBJECT_LOG = JSON.stringify(OLD_PROJECT_KEYWORD_OBJECT)
const SHORT_NAME_FALLBACK_KEYWORD_OBJECT = {
  Aliases: ['   '],
  ShortName: 'Fallback Short Name'
}
const SHORT_NAME_FALLBACK_KEYWORD_OBJECT_LOG = JSON.stringify(SHORT_NAME_FALLBACK_KEYWORD_OBJECT)

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
                  OldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
                  NewKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
                  Timestamp: '2026-04-21T00:00:00.000Z'
                })
              })
            }
          ]
        })

        expect(getCmrCollectionConceptIds).toHaveBeenCalledWith({
          scheme: 'sciencekeywords',
          uuid: '1234',
          keywordObject: NEW_SCIENCE_KEYWORD_OBJECT
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
          expect.stringContaining(`keywordObject=${NEW_SCIENCE_KEYWORD_OBJECT_LOG}`)
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
            oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
            newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
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
            oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
            newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
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

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('keywordObject=n/a')
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
                  NewKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT
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

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(`keywordObject=${NEW_SCIENCE_KEYWORD_OBJECT_LOG}`)
        )

        expect(getCmrCollectionConceptIds).not.toHaveBeenCalled()
        expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
        expect(result).toEqual({
          batchItemFailures: []
        })
      })

      test('should prefer the old keyword object for deleted events when no replacement object exists', async () => {
        vi.mocked(getCmrCollectionConceptIds).mockResolvedValue(['C1000000000-PROV'])

        const result = await cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-delete-123',
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'DELETED',
                  Scheme: 'projects',
                  UUID: 'project-1234',
                  OldKeywordObject: OLD_PROJECT_KEYWORD_OBJECT,
                  Timestamp: '2026-04-22T00:00:00.000Z'
                })
              })
            }
          ]
        })

        expect(getCmrCollectionConceptIds).toHaveBeenCalledWith({
          scheme: 'projects',
          uuid: 'project-1234',
          keywordObject: OLD_PROJECT_KEYWORD_OBJECT
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(`keywordObject=${OLD_PROJECT_KEYWORD_OBJECT_LOG}`)
        )

        expect(publishMetadataCorrectionRequest).toHaveBeenCalledWith({
          source: 'cmrKeywordEventsListener',
          collectionConceptId: 'C1000000000-PROV',
          keywordEvent: {
            eventType: 'DELETED',
            scheme: 'projects',
            uuid: 'project-1234',
            oldKeywordObject: OLD_PROJECT_KEYWORD_OBJECT,
            newKeywordObject: undefined,
            timestamp: '2026-04-22T00:00:00.000Z'
          }
        })

        expect(result).toEqual({
          batchItemFailures: []
        })
      })

      test('should treat a scalar keyword field as meaningful even when another array field is blank', async () => {
        vi.mocked(getCmrCollectionConceptIds).mockResolvedValue(['C1000000000-PROV'])

        const result = await cmrKeywordEventsListener({
          Records: [
            {
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'UPDATED',
                  Scheme: 'projects',
                  UUID: 'project-5678',
                  NewKeywordObject: SHORT_NAME_FALLBACK_KEYWORD_OBJECT
                })
              })
            }
          ]
        })

        expect(getCmrCollectionConceptIds).toHaveBeenCalledWith({
          scheme: 'projects',
          uuid: 'project-5678',
          keywordObject: SHORT_NAME_FALLBACK_KEYWORD_OBJECT
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(`keywordObject=${SHORT_NAME_FALLBACK_KEYWORD_OBJECT_LOG}`)
        )

        expect(result).toEqual({
          batchItemFailures: []
        })
      })

      test('should not fall back to the old keyword object for updated events', async () => {
        vi.mocked(getCmrCollectionConceptIds).mockResolvedValue(['C1000000000-PROV'])

        const result = await cmrKeywordEventsListener({
          Records: [
            {
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'UPDATED',
                  Scheme: 'projects',
                  UUID: 'project-9012',
                  OldKeywordObject: OLD_PROJECT_KEYWORD_OBJECT
                })
              })
            }
          ]
        })

        expect(getCmrCollectionConceptIds).toHaveBeenCalledWith({
          scheme: 'projects',
          uuid: 'project-9012',
          keywordObject: undefined
        })

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('keywordObject=n/a')
        )

        expect(result).toEqual({
          batchItemFailures: []
        })
      })

      test('should keep publish logging safe when the publish helper returns a partial result object', async () => {
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

      test('should serialize an undefined error payload without failing in the logger path', async () => {
        vi.mocked(getCmrCollectionConceptIds).mockRejectedValueOnce(undefined)

        await expect(cmrKeywordEventsListener({
          Records: [
            {
              messageId: 'message-123',
              body: JSON.stringify({
                Type: 'Notification',
                Message: JSON.stringify({
                  EventType: 'UPDATED',
                  Scheme: 'sciencekeywords',
                  UUID: '1234',
                  NewKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT
                })
              })
            }
          ]
        })).rejects.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith('Failed to process keyword event record', {
          messageId: 'message-123',
          eventType: 'UPDATED',
          scheme: 'sciencekeywords',
          uuid: '1234',
          keywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
          error: undefined
        })
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

        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('keywordObject=n/a')
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

      test('should log n/a as the message id when parsing fails before a message id is available', async () => {
        await expect(cmrKeywordEventsListener({
          Records: [
            {
              body: 'not-json'
            }
          ]
        })).rejects.toThrow()

        expect(logger.error).toHaveBeenCalledWith('Failed to process keyword event record', {
          messageId: 'n/a',
          eventType: 'n/a',
          scheme: 'n/a',
          uuid: 'n/a',
          keywordObject: 'n/a',
          error: expect.any(Object)
        })
      })
    })

    describe('when concept-id lookup fails', () => {
      test('should log the error and throw', async () => {
        const error = new TypeError('fetch failed')

        error.cmrRequest = {
          method: 'GET',
          endpoint: 'https://cmr.sit.earthdata.nasa.gov',
          path: '/search/collections.umm_json?keyword=1234&page_size=2000&page_num=1',
          fullUrl: 'https://cmr.sit.earthdata.nasa.gov/search/collections.umm_json?keyword=1234&page_size=2000&page_num=1'
        }

        error.cmrCause = {
          name: 'Error',
          message: 'connect ETIMEDOUT 10.0.0.15:443',
          code: 'ETIMEDOUT',
          errno: -60,
          syscall: 'connect',
          address: '10.0.0.15',
          port: 443
        }

        vi.mocked(getCmrCollectionConceptIds).mockRejectedValue(error)

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
        })).rejects.toThrow('fetch failed')

        expect(logger.error).toHaveBeenCalledWith('Failed to process keyword event record', {
          messageId: 'message-123',
          eventType: 'UPDATED',
          scheme: 'sciencekeywords',
          uuid: '1234',
          keywordObject: 'n/a',
          error: expect.objectContaining({
            name: 'TypeError',
            message: 'fetch failed',
            cmrRequest: {
              method: 'GET',
              endpoint: 'https://cmr.sit.earthdata.nasa.gov',
              path: '/search/collections.umm_json?keyword=1234&page_size=2000&page_num=1',
              fullUrl: 'https://cmr.sit.earthdata.nasa.gov/search/collections.umm_json?keyword=1234&page_size=2000&page_num=1'
            },
            cmrCause: {
              name: 'Error',
              message: 'connect ETIMEDOUT 10.0.0.15:443',
              code: 'ETIMEDOUT',
              errno: -60,
              syscall: 'connect',
              address: '10.0.0.15',
              port: 443
            }
          })
        })
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
                  Scheme: 'sciencekeywords',
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
