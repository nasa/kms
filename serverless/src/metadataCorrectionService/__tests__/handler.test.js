import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { applyDif10MetadataCorrections } from '@/shared/applyDif10MetadataCorrections'
import { logger } from '@/shared/logger'
import { writeCorrectedMetadataToCmr } from '@/shared/writeCorrectedMetadataToCmr'

import { metadataCorrectionService } from '../handler'

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/shared/applyDif10MetadataCorrections', () => ({
  applyDif10MetadataCorrections: vi.fn()
}))

vi.mock('@/shared/writeCorrectedMetadataToCmr', () => ({
  writeCorrectedMetadataToCmr: vi.fn()
}))

describe('when the metadata correction service is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(applyDif10MetadataCorrections).mockResolvedValue({
      correctionCount: 1,
      correctionsApplied: [{ scheme: 'sciencekeywords' }],
      correctedMetadata: '<DIF><Entry_ID/></DIF>',
      stubbed: false
    })

    vi.mocked(writeCorrectedMetadataToCmr).mockResolvedValue({
      stubbed: true,
      targetComponent: 'cmr-writeback',
      collectionConceptId: 'C0000000000-KMS',
      nativeFormat: 'DIF10',
      correctionCount: 1,
      correctionsAppliedCount: 1,
      correctedMetadataBytes: 21
    })
  })

  describe('when the invocation is successful', () => {
    test('should apply dif10 corrections and invoke the cmr write stub when native metadata inputs are present', async () => {
      const metadataCorrectionRequest = {
        source: 'metadataCorrectionServiceTest',
        collectionConceptId: 'C0000000000-KMS',
        nativeFormat: 'DIF10',
        metadataPayload: '<DIF><Entry_ID/></DIF>',
        corrections: [
          {
            scheme: 'sciencekeywords',
            action: 'replace',
            oldKeywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
            newKeywordPath: 'EARTH SCIENCE > OCEANS > MARINE SEDIMENTS'
          }
        ]
      }

      const result = await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-123',
            body: JSON.stringify(metadataCorrectionRequest)
          }
        ]
      })

      expect(applyDif10MetadataCorrections).toHaveBeenCalledWith({
        ...metadataCorrectionRequest,
        nativeFormat: 'DIF10'
      })

      expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith({
        collectionConceptId: 'C0000000000-KMS',
        nativeFormat: 'DIF10',
        correctedMetadata: '<DIF><Entry_ID/></DIF>',
        correctionCount: 1,
        correctionsApplied: [{ scheme: 'sciencekeywords' }],
        source: 'metadataCorrectionServiceTest'
      })

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Produced corrected metadata payload',
        expect.objectContaining({
          collectionConceptId: 'C0000000000-KMS',
          messageId: 'message-123',
          nativeFormat: 'DIF10',
          correctionCount: 1
        })
      )

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Stubbed corrected metadata write to CMR',
        expect.objectContaining({
          collectionConceptId: 'C0000000000-KMS',
          messageId: 'message-123',
          nativeFormat: 'DIF10',
          correctionCount: 1,
          writeResult: expect.objectContaining({
            targetComponent: 'cmr-writeback'
          })
        })
      )

      expect(result).toEqual({
        batchItemFailures: []
      })
    })

    test('should apply fallback write values when optional corrected metadata details are missing', async () => {
      vi.mocked(applyDif10MetadataCorrections).mockResolvedValue({
        correctionCount: undefined,
        correctionsApplied: null,
        correctedMetadata: null,
        stubbed: false
      })

      await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-124',
            body: JSON.stringify({
              collectionConceptId: 'C0000000001-KMS',
              nativeFormat: ' dif10 ',
              metadataPayload: '<DIF><Entry_ID/></DIF>',
              corrections: []
            })
          }
        ]
      })

      expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith({
        collectionConceptId: 'C0000000001-KMS',
        nativeFormat: 'DIF10',
        correctedMetadata: '',
        correctionCount: 0,
        correctionsApplied: [],
        source: 'metadataCorrectionService'
      })
    })

    test('should acknowledge an empty batch', async () => {
      await expect(metadataCorrectionService()).resolves.toEqual({
        batchItemFailures: []
      })
    })
  })

  describe('when the invocation is unsuccessful', () => {
    test('should reject current listener-shaped requests that do not include native metadata inputs', async () => {
      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-456',
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
      })).rejects.toThrow(
        'Incomplete metadata correction request: missing nativeFormat, metadataPayload, corrections'
      )

      expect(applyDif10MetadataCorrections).not.toHaveBeenCalled()
      expect(writeCorrectedMetadataToCmr).not.toHaveBeenCalled()
    })

    test('should reject unsupported native formats without invoking the cmr write stub', async () => {
      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-789',
            body: JSON.stringify({
              source: 'metadataCorrectionServiceTest',
              collectionConceptId: 'C0000000000-KMS',
              nativeFormat: 'ECHO10',
              metadataPayload: '<ECHO10/>',
              corrections: []
            })
          }
        ]
      })).rejects.toThrow('Unsupported native format: ECHO10')

      expect(applyDif10MetadataCorrections).not.toHaveBeenCalled()
      expect(writeCorrectedMetadataToCmr).not.toHaveBeenCalled()
    })

    test('should reject a missing record body as an incomplete request', async () => {
      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-999'
          }
        ]
      })).rejects.toThrow(
        'Incomplete metadata correction request: missing collectionConceptId, nativeFormat, metadataPayload, corrections'
      )

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Received metadata correction request',
        expect.objectContaining({
          messageId: 'message-999',
          metadataCorrectionRequest: {}
        })
      )
    })

    test('should log the error and throw when the record body cannot be parsed', async () => {
      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-123',
            body: 'not-json'
          }
        ]
      })).rejects.toThrow()

      expect(logger.error).toHaveBeenCalledWith(
        '[metadata-correction] Failed to process metadata correction request',
        expect.anything()
      )
    })
  })
})
