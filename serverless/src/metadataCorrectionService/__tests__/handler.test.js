import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'

import { metadataCorrectionService } from '../handler'

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

describe('when the metadata correction service is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when the invocation is successful', () => {
    test('should log the parsed metadata correction request and acknowledge the batch', async () => {
      const result = await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-123',
            body: JSON.stringify({
              source: 'cmrKeywordEventsListener',
              collectionConceptId: 'C0000000000-KMS',
              keywordEvent: {
                eventType: 'UPDATED',
                uuid: '1234'
              }
            })
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Received metadata correction request',
        expect.objectContaining({
          collectionConceptId: 'C0000000000-KMS',
          messageId: 'message-123',
          metadataCorrectionRequest: expect.objectContaining({
            source: 'cmrKeywordEventsListener',
            keywordEvent: expect.objectContaining({
              eventType: 'UPDATED',
              uuid: '1234'
            })
          })
        })
      )

      expect(result).toEqual({
        batchItemFailures: []
      })
    })

    test('should acknowledge an empty batch', async () => {
      await expect(metadataCorrectionService()).resolves.toEqual({
        batchItemFailures: []
      })
    })

    test('should treat a missing record body as an empty request', async () => {
      const result = await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-456'
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Received metadata correction request',
        expect.objectContaining({
          messageId: 'message-456',
          metadataCorrectionRequest: {}
        })
      )

      expect(result).toEqual({
        batchItemFailures: []
      })
    })
  })

  describe('when the invocation is unsuccessful', () => {
    test('should log the error and throw when the record body cannot be parsed', async () => {
      await expect(metadataCorrectionService({
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
