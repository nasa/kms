import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { detectNativeMetadataFormat } from '@/shared/detectNativeMetadataFormat'
import { extractKeywordValidationFailures } from '@/shared/extractKeywordValidationFailures'
import { getCmrCollectionUmmDetails } from '@/shared/getCmrCollectionUmmDetails'
import { ingestCorrectedMetadataStub } from '@/shared/ingestCorrectedMetadataStub'
import { invokeMetadataCorrectionDelegate } from '@/shared/invokeMetadataCorrectionDelegate'
import { logger } from '@/shared/logger'
import { resolveOldKeywordConceptUuid } from '@/shared/resolveOldKeywordConceptUuid'
import { validateCmrCollectionUmm } from '@/shared/validateCmrCollectionUmm'

import { metadataCorrectionService } from '../handler'

vi.mock('@/shared/detectNativeMetadataFormat', () => ({
  detectNativeMetadataFormat: vi.fn()
}))

vi.mock('@/shared/getCmrCollectionUmmDetails', () => ({
  getCmrCollectionUmmDetails: vi.fn()
}))

vi.mock('@/shared/invokeMetadataCorrectionDelegate', () => ({
  invokeMetadataCorrectionDelegate: vi.fn()
}))

vi.mock('@/shared/ingestCorrectedMetadataStub', () => ({
  ingestCorrectedMetadataStub: vi.fn()
}))

vi.mock('@/shared/validateCmrCollectionUmm', () => ({
  validateCmrCollectionUmm: vi.fn()
}))

vi.mock('@/shared/extractKeywordValidationFailures', () => ({
  extractKeywordValidationFailures: vi.fn()
}))

vi.mock('@/shared/resolveOldKeywordConceptUuid', () => ({
  resolveOldKeywordConceptUuid: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}))

describe('when the metadata correction service is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(detectNativeMetadataFormat).mockReturnValue('UMM')
    vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
      nativeFormat: 'UMM',
      delegateName: 'umm',
      correctionCount: 1,
      correctedMetadata: {
        ShortName: 'TEST'
      },
      correctionsApplied: [],
      stubbed: true
    })

    vi.mocked(ingestCorrectedMetadataStub).mockResolvedValue({
      collectionConceptId: 'C0000000000-KMS',
      nativeFormat: 'UMM',
      correctionCount: 1,
      ingested: false,
      stubbed: true
    })

    vi.mocked(resolveOldKeywordConceptUuid).mockImplementation(async ({ oldKeyword }) => {
      if (!oldKeyword) {
        return undefined
      }

      const lookupValue = oldKeyword.replace('[resolve old keyword from UMM-C value: ', '').replace(']', '')

      return {
        keywordConceptUuid: oldKeyword,
        oldKeywordPath: lookupValue,
        newKeywordPath: lookupValue
      }
    })
  })

  describe('when the invocation is successful', () => {
    test('should fetch UMM, validate it, extract keyword failures, and acknowledge the batch', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C0000000000-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-123',
        format: 'application/vnd.nasa.cmr.umm+json',
        umm: {
          ShortName: 'TEST'
        }
      })

      vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
        status: 400,
        errors: [
          {
            path: ['ScienceKeywords', 0],
            errors: ['Science keyword was not a valid keyword combination.']
          }
        ],
        warnings: [],
        responseBody: {
          errors: [
            {
              path: ['ScienceKeywords', 0],
              errors: ['Science keyword was not a valid keyword combination.']
            }
          ]
        }
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'sciencekeywords',
          path: ['ScienceKeywords', 0],
          errors: ['Science keyword was not a valid keyword combination.'],
          oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE]',
          keywordValue: {
            Category: 'EARTH SCIENCE'
          }
        }
      ])

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

      expect(getCmrCollectionUmmDetails).toHaveBeenCalledWith({
        collectionConceptId: 'C0000000000-KMS'
      })

      expect(validateCmrCollectionUmm).toHaveBeenCalledWith({
        providerId: 'KMS',
        nativeId: 'native-id-123',
        umm: {
          ShortName: 'TEST'
        }
      })

      expect(detectNativeMetadataFormat).toHaveBeenCalledWith({
        format: 'application/vnd.nasa.cmr.umm+json'
      })

      expect(extractKeywordValidationFailures).toHaveBeenCalledWith({
        umm: {
          ShortName: 'TEST'
        },
        validationErrors: [
          {
            path: ['ScienceKeywords', 0],
            errors: ['Science keyword was not a valid keyword combination.']
          }
        ]
      })

      expect(resolveOldKeywordConceptUuid).toHaveBeenCalledWith({
        scheme: 'sciencekeywords',
        oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE]'
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[metadata-correction] Received metadata correction request ')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('collectionConceptId=C0000000000-KMS')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('messageId=message-123')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('source=cmrKeywordEventsListener')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('eventType=UPDATED')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('scheme=n/a')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('uuid=1234')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[metadata-correction] Extracted keyword validation failure ')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('collectionConceptId=C0000000000-KMS')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('scheme=sciencekeywords')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('path=ScienceKeywords.0')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('oldKeyword=[resolve old keyword from UMM-C value: EARTH SCIENCE]')
      )

      expect(invokeMetadataCorrectionDelegate).toHaveBeenCalledWith({
        nativeFormat: 'UMM',
        collectionConceptId: 'C0000000000-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-123',
        metadataPayload: {
          ShortName: 'TEST'
        },
        corrections: [
          {
            scheme: 'sciencekeywords',
            ummPath: ['ScienceKeywords', 0],
            keywordConceptUuid: '[resolve old keyword from UMM-C value: EARTH SCIENCE]',
            oldKeywordPath: 'EARTH SCIENCE',
            newKeywordPath: 'EARTH SCIENCE'
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[metadata-correction] Invoked metadata correction delegate ')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('delegateName=umm')
      )

      expect(ingestCorrectedMetadataStub).toHaveBeenCalledWith({
        collectionConceptId: 'C0000000000-KMS',
        nativeFormat: 'UMM',
        correctionCount: 1
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[metadata-correction] Invoked metadata ingest stub ')
      )

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('No keyword validation failures extracted')
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

    test('should log a single no-failures line when no keyword validation failures are extracted', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C0000000001-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-456',
        format: 'application/vnd.nasa.cmr.umm+json',
        umm: {
          ShortName: 'TEST-2'
        }
      })

      vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
        status: 200,
        errors: [],
        warnings: [],
        responseBody: {}
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([])

      await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-124',
            body: JSON.stringify({
              collectionConceptId: 'C0000000001-KMS'
            })
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '[metadata-correction] No keyword validation failures extracted '
        )
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('collectionConceptId=C0000000001-KMS')
      )

      expect(invokeMetadataCorrectionDelegate).not.toHaveBeenCalled()
      expect(ingestCorrectedMetadataStub).not.toHaveBeenCalled()
    })

    test('should skip records without a collection concept id', async () => {
      const result = await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-456'
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Skipping request without collection concept id messageId=message-456'
      )

      expect(getCmrCollectionUmmDetails).not.toHaveBeenCalled()
      expect(validateCmrCollectionUmm).not.toHaveBeenCalled()
      expect(extractKeywordValidationFailures).not.toHaveBeenCalled()

      expect(result).toEqual({
        batchItemFailures: []
      })
    })

    test('should delegate and ingest actionable corrections when some keyword failures are unresolved', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C0000000005-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-partial',
        format: 'application/vnd.nasa.cmr.umm+json',
        umm: {
          ShortName: 'TEST-PARTIAL'
        }
      })

      vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
        status: 400,
        errors: [
          {
            path: ['ScienceKeywords', 0],
            errors: ['Science keyword was not a valid keyword combination.']
          },
          {
            path: ['Projects', 0],
            errors: ['Project was not a valid keyword combination.']
          }
        ],
        warnings: [],
        responseBody: {}
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'sciencekeywords',
          path: ['ScienceKeywords', 0],
          errors: ['Science keyword was not a valid keyword combination.'],
          oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE]',
          keywordValue: {
            Category: 'EARTH SCIENCE'
          }
        },
        {
          scheme: 'projects',
          path: ['Projects', 0],
          errors: ['Project was not a valid keyword combination.'],
          oldKeyword: '[resolve old keyword from UMM-C value: ACTIVATE]',
          keywordValue: {
            ShortName: 'ACTIVATE'
          }
        }
      ])

      vi.mocked(resolveOldKeywordConceptUuid)
        .mockResolvedValueOnce({
          keywordConceptUuid: 'science-uuid-123',
          oldKeywordPath: 'EARTH SCIENCE',
          newKeywordPath: 'EARTH SCIENCE'
        })
        .mockResolvedValueOnce(undefined)

      vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
        nativeFormat: 'UMM',
        delegateName: 'umm',
        correctionCount: 1,
        correctedMetadata: {
          ShortName: 'TEST-PARTIAL'
        },
        correctionsApplied: [],
        stubbed: true
      })

      vi.mocked(ingestCorrectedMetadataStub).mockResolvedValue({
        collectionConceptId: 'C0000000005-KMS',
        nativeFormat: 'UMM',
        correctionCount: 1,
        ingested: false,
        stubbed: true
      })

      await metadataCorrectionService({
        Records: [
          {
            body: JSON.stringify({
              collectionConceptId: 'C0000000005-KMS'
            })
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Proceeding with partial keyword corrections collectionConceptId=C0000000005-KMS providerId=KMS nativeId=native-id-partial actionableKeywordValidationFailureCount=1 unresolvedKeywordValidationFailureCount=1'
      )

      expect(invokeMetadataCorrectionDelegate).toHaveBeenCalledWith({
        nativeFormat: 'UMM',
        collectionConceptId: 'C0000000005-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-partial',
        metadataPayload: {
          ShortName: 'TEST-PARTIAL'
        },
        corrections: [
          {
            scheme: 'sciencekeywords',
            ummPath: ['ScienceKeywords', 0],
            keywordConceptUuid: 'science-uuid-123',
            oldKeywordPath: 'EARTH SCIENCE',
            newKeywordPath: 'EARTH SCIENCE'
          }
        ]
      })

      expect(ingestCorrectedMetadataStub).toHaveBeenCalledWith({
        collectionConceptId: 'C0000000005-KMS',
        nativeFormat: 'UMM',
        correctionCount: 1
      })
    })

    test('should skip delegate and ingest when keyword failures cannot be resolved to a concept uuid', async () => {
      vi.mocked(detectNativeMetadataFormat).mockReturnValue('ISO19115')
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C0000000003-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-iso',
        format: 'application/iso19115+xml',
        umm: {
          ShortName: 'TEST-ISO'
        }
      })

      vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
        status: 400,
        errors: [
          {
            path: ['Projects', 0],
            errors: []
          }
        ],
        warnings: [],
        responseBody: {}
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'projects',
          path: undefined,
          errors: [],
          oldKeyword: undefined,
          keywordValue: undefined
        }
      ])

      vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue(undefined)
      vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
        nativeFormat: 'ISO19115',
        delegateName: 'iso19115',
        correctionCount: 1,
        correctedMetadata: undefined,
        correctionsApplied: [],
        stubbed: true
      })

      vi.mocked(ingestCorrectedMetadataStub).mockResolvedValue({
        collectionConceptId: 'C0000000003-KMS',
        nativeFormat: 'ISO19115',
        correctionCount: 1,
        ingested: false,
        stubbed: true
      })

      await metadataCorrectionService({
        Records: [
          {
            body: JSON.stringify({
              collectionConceptId: 'C0000000003-KMS'
            })
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('oldKeyword=n/a')
      )

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('message=n/a')
      )

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] No resolvable keyword corrections found collectionConceptId=C0000000003-KMS providerId=KMS nativeId=native-id-iso keywordValidationFailureCount=1'
      )

      expect(invokeMetadataCorrectionDelegate).not.toHaveBeenCalled()
      expect(ingestCorrectedMetadataStub).not.toHaveBeenCalled()
    })

    test('should omit metadata payload when invoking a non-UMM delegate with actionable corrections', async () => {
      vi.mocked(detectNativeMetadataFormat).mockReturnValue('ISO19115')
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C0000000004-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-iso-actionable',
        format: 'application/iso19115+xml',
        umm: {
          ShortName: 'TEST-ISO-ACTIONABLE'
        }
      })

      vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
        status: 400,
        errors: [
          {
            path: ['Projects', 0],
            errors: ['Project was not a valid keyword combination.']
          }
        ],
        warnings: [],
        responseBody: {}
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'projects',
          path: ['Projects', 0],
          errors: ['Project was not a valid keyword combination.'],
          oldKeyword: '[resolve old keyword from UMM-C value: ACTIVATE]',
          keywordValue: {
            ShortName: 'ACTIVATE'
          }
        }
      ])

      vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
        keywordConceptUuid: 'project-uuid-123',
        oldKeywordPath: 'ACTIVATE',
        newKeywordPath: 'ACTIVATE'
      })

      vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
        nativeFormat: 'ISO19115',
        delegateName: 'iso19115',
        correctionCount: 1,
        correctedMetadata: undefined,
        correctionsApplied: [],
        stubbed: true
      })

      vi.mocked(ingestCorrectedMetadataStub).mockResolvedValue({
        collectionConceptId: 'C0000000004-KMS',
        nativeFormat: 'ISO19115',
        correctionCount: 1,
        ingested: false,
        stubbed: true
      })

      await metadataCorrectionService({
        Records: [
          {
            body: JSON.stringify({
              collectionConceptId: 'C0000000004-KMS'
            })
          }
        ]
      })

      expect(invokeMetadataCorrectionDelegate).toHaveBeenCalledWith({
        nativeFormat: 'ISO19115',
        collectionConceptId: 'C0000000004-KMS',
        providerId: 'KMS',
        nativeId: 'native-id-iso-actionable',
        metadataPayload: undefined,
        corrections: [
          {
            scheme: 'projects',
            ummPath: ['Projects', 0],
            keywordConceptUuid: 'project-uuid-123',
            oldKeywordPath: 'ACTIVATE',
            newKeywordPath: 'ACTIVATE'
          }
        ]
      })
    })

    test('should use n/a when a skipped record has no message id', async () => {
      await metadataCorrectionService({
        Records: [
          {
            body: JSON.stringify({})
          }
        ]
      })

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] Skipping request without collection concept id messageId=n/a'
      )
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

    test('should log the error and throw when downstream processing fails', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockRejectedValue(new Error('CMR lookup failed'))

      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-789',
            body: JSON.stringify({
              collectionConceptId: 'C0000000000-KMS'
            })
          }
        ]
      })).rejects.toThrow('CMR lookup failed')

      expect(logger.error).toHaveBeenCalledWith(
        '[metadata-correction] Failed to process metadata correction request',
        expect.any(Error)
      )
    })
  })
})
