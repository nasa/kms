import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { extractKeywordValidationFailures } from '@/shared/extractKeywordValidationFailures'
import { getCmrCollectionNativeMetadata } from '@/shared/getCmrCollectionNativeMetadata'
import { getCmrCollectionUmmDetails } from '@/shared/getCmrCollectionUmmDetails'
import { invokeMetadataCorrectionDelegate } from '@/shared/invokeMetadataCorrectionDelegate'
import { logger } from '@/shared/logger'
import { persistMetadataCorrectionAuditLog } from '@/shared/persistMetadataCorrectionAuditLog'
import { resolveOldKeywordConceptUuid } from '@/shared/resolveOldKeywordConceptUuid'
import { validateCmrCollectionUmm } from '@/shared/validateCmrCollectionUmm'
import { writeCorrectedMetadataToCmr } from '@/shared/writeCorrectedMetadataToCmr'

import { metadataCorrectionService } from '../handler'

vi.mock('@/shared/extractKeywordValidationFailures', () => ({
  extractKeywordValidationFailures: vi.fn()
}))

vi.mock('@/shared/getCmrCollectionNativeMetadata', () => ({
  getCmrCollectionNativeMetadata: vi.fn()
}))

vi.mock('@/shared/getCmrCollectionUmmDetails', () => ({
  getCmrCollectionUmmDetails: vi.fn()
}))

vi.mock('@/shared/invokeMetadataCorrectionDelegate', () => ({
  invokeMetadataCorrectionDelegate: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/shared/persistMetadataCorrectionAuditLog', () => ({
  persistMetadataCorrectionAuditLog: vi.fn()
}))

vi.mock('@/shared/resolveOldKeywordConceptUuid', () => ({
  resolveOldKeywordConceptUuid: vi.fn()
}))

vi.mock('@/shared/validateCmrCollectionUmm', () => ({
  validateCmrCollectionUmm: vi.fn()
}))

vi.mock('@/shared/writeCorrectedMetadataToCmr', () => ({
  writeCorrectedMetadataToCmr: vi.fn()
}))

const OLD_SCIENCE_KEYWORD_OBJECT = {
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'LEGACY AEROSOLS'
}

const NEW_SCIENCE_KEYWORD_OBJECT = {
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'AEROSOLS'
}

const OLD_TRIGGER_SCIENCE_KEYWORD_OBJECT = {
  PathSegments: ['EARTH SCIENCE', 'ATMOSPHERE', 'LEGACY AEROSOLS'],
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'LEGACY AEROSOLS',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

const NEW_TRIGGER_SCIENCE_KEYWORD_OBJECT = {
  PathSegments: ['EARTH SCIENCE', 'ATMOSPHERE', 'AEROSOLS'],
  Category: 'EARTH SCIENCE',
  Topic: 'ATMOSPHERE',
  Term: 'AEROSOLS',
  VariableLevel1: '',
  VariableLevel2: '',
  VariableLevel3: '',
  DetailedVariable: ''
}

describe('when the metadata correction service is invoked', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
      nativeFormat: 'DIF10',
      delegateName: 'dif10',
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

    vi.mocked(persistMetadataCorrectionAuditLog).mockResolvedValue({
      insertedCount: 1,
      publishedVersionName: 'published',
      status: 'pending'
    })
  })

  describe('when the invocation is successful', () => {
    test('should resolve collection-scoped DIF10 requests through fetch, validate, resolve, audit, and delegate steps', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C123-PROV',
        providerId: 'PROV',
        nativeId: 'native-123',
        revisionId: 9,
        format: 'DIF+XML',
        umm: {
          ScienceKeywords: [
            {
              Category: 'EARTH SCIENCE',
              Topic: 'ATMOSPHERE',
              Term: 'LEGACY AEROSOLS'
            }
          ]
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
          ],
          warnings: []
        }
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'sciencekeywords',
          path: ['ScienceKeywords', 0],
          oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE|ATMOSPHERE|LEGACY AEROSOLS]',
          keywordValue: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'LEGACY AEROSOLS'
          },
          errors: ['Science keyword was not a valid keyword combination.']
        }
      ])

      vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
        keywordConceptUuid: 'science-uuid-1',
        oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
        newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
        action: 'replace'
      })

      vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue('<DIF><Entry_ID/></DIF>')

      vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
        nativeFormat: 'DIF10',
        delegateName: 'dif10',
        correctionCount: 1,
        correctedMetadata: '<DIF><Entry_ID>updated</Entry_ID></DIF>',
        correctionsApplied: [
          {
            scheme: 'sciencekeywords',
            keywordConceptUuid: 'science-uuid-1',
            oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
            newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
            action: 'replace',
            ummPath: ['ScienceKeywords', 0]
          }
        ],
        stubbed: true
      })

      await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-collection-1',
            body: JSON.stringify({
              source: 'cmrKeywordEventsListener',
              collectionConceptId: 'C123-PROV',
              keywordEvent: {
                eventType: 'UPDATED',
                scheme: 'sciencekeywords',
                uuid: 'science-uuid-1',
                oldKeywordObject: OLD_TRIGGER_SCIENCE_KEYWORD_OBJECT,
                newKeywordObject: NEW_TRIGGER_SCIENCE_KEYWORD_OBJECT
              }
            })
          }
        ]
      })

      expect(getCmrCollectionUmmDetails).toHaveBeenCalledWith({
        collectionConceptId: 'C123-PROV'
      })

      expect(validateCmrCollectionUmm).toHaveBeenCalledWith({
        providerId: 'PROV',
        nativeId: 'native-123',
        umm: {
          ScienceKeywords: [
            {
              Category: 'EARTH SCIENCE',
              Topic: 'ATMOSPHERE',
              Term: 'LEGACY AEROSOLS'
            }
          ]
        }
      })

      expect(resolveOldKeywordConceptUuid).toHaveBeenCalledWith({
        scheme: 'sciencekeywords',
        keywordValue: {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'LEGACY AEROSOLS'
        },
        keywordEvent: {
          eventType: 'UPDATED',
          scheme: 'sciencekeywords',
          uuid: 'science-uuid-1',
          oldKeywordObject: OLD_TRIGGER_SCIENCE_KEYWORD_OBJECT,
          newKeywordObject: NEW_TRIGGER_SCIENCE_KEYWORD_OBJECT
        }
      })

      expect(invokeMetadataCorrectionDelegate).toHaveBeenCalledWith({
        collectionConceptId: 'C123-PROV',
        providerId: 'PROV',
        nativeId: 'native-123',
        nativeFormat: 'DIF10',
        metadataPayload: '<DIF><Entry_ID/></DIF>',
        corrections: [
          {
            scheme: 'sciencekeywords',
            keywordConceptUuid: 'science-uuid-1',
            oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
            newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
            action: 'replace',
            ummPath: ['ScienceKeywords', 0]
          }
        ]
      })

      expect(persistMetadataCorrectionAuditLog).toHaveBeenCalledWith({
        collectionConceptId: 'C123-PROV',
        keywordEvent: {
          eventType: 'UPDATED',
          scheme: 'sciencekeywords',
          uuid: 'science-uuid-1',
          oldKeywordObject: OLD_TRIGGER_SCIENCE_KEYWORD_OBJECT,
          newKeywordObject: NEW_TRIGGER_SCIENCE_KEYWORD_OBJECT
        },
        nativeFormat: 'DIF10',
        delegateName: 'dif10',
        corrections: [
          {
            scheme: 'sciencekeywords',
            keywordConceptUuid: 'science-uuid-1',
            oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
            newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
            action: 'replace',
            ummPath: ['ScienceKeywords', 0]
          }
        ],
        status: 'pending'
      })

      expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith({
        collectionConceptId: 'C123-PROV',
        nativeFormat: 'DIF10',
        correctedMetadata: '<DIF><Entry_ID>updated</Entry_ID></DIF>',
        correctionCount: 1,
        correctionsApplied: [
          {
            scheme: 'sciencekeywords',
            keywordConceptUuid: 'science-uuid-1',
            oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
            newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
            action: 'replace',
            ummPath: ['ScienceKeywords', 0]
          }
        ],
        source: 'cmrKeywordEventsListener'
      })
    })

    test('should allow collection-only requests and skip delete inference without keyword-event context', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C999-DIF10',
        providerId: 'PROV',
        nativeId: 'native-dif10',
        revisionId: 4,
        format: 'DIF+XML',
        umm: {
          ScienceKeywords: [
            {
              Category: 'EARTH SCIENCE',
              Topic: 'ATMOSPHERE',
              Term: 'LEGACY AEROSOLS'
            }
          ]
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
          ],
          warnings: []
        }
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'sciencekeywords',
          path: ['ScienceKeywords', 0],
          oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE|ATMOSPHERE|LEGACY AEROSOLS]',
          keywordValue: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'LEGACY AEROSOLS'
          },
          errors: ['Science keyword was not a valid keyword combination.']
        }
      ])

      vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
        keywordConceptUuid: 'science-uuid-1',
        oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
        newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
        action: 'replace'
      })

      vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue('<DIF><Entry_ID/></DIF>')

      await metadataCorrectionService({
        Records: [
          {
            messageId: 'message-dif10-1',
            body: JSON.stringify({
              source: 'metadataCorrectionServiceTest',
              collectionConceptId: 'C999-DIF10'
            })
          }
        ]
      })

      expect(resolveOldKeywordConceptUuid).toHaveBeenCalledWith({
        scheme: 'sciencekeywords',
        keywordValue: {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'LEGACY AEROSOLS'
        },
        keywordEvent: {}
      })

      expect(getCmrCollectionNativeMetadata).toHaveBeenCalledWith({
        collectionConceptId: 'C999-DIF10',
        revisionId: 4
      })
    })

    test('should stop cleanly when the collection request has no resolvable corrections', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C123-PROV',
        providerId: 'PROV',
        nativeId: 'native-123',
        revisionId: 9,
        format: 'DIF+XML',
        umm: {
          ScienceKeywords: [
            {
              Category: 'EARTH SCIENCE',
              Topic: 'ATMOSPHERE',
              Term: 'LEGACY AEROSOLS'
            }
          ]
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
          ],
          warnings: []
        }
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'sciencekeywords',
          path: ['ScienceKeywords', 0],
          oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE|ATMOSPHERE|LEGACY AEROSOLS]',
          keywordValue: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'LEGACY AEROSOLS'
          },
          errors: ['Science keyword was not a valid keyword combination.']
        }
      ])

      vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue(undefined)

      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-collection-2',
            body: JSON.stringify({
              collectionConceptId: 'C123-PROV'
            })
          }
        ]
      })).resolves.toEqual({
        batchItemFailures: []
      })

      expect(invokeMetadataCorrectionDelegate).not.toHaveBeenCalled()
      expect(persistMetadataCorrectionAuditLog).not.toHaveBeenCalled()
      expect(writeCorrectedMetadataToCmr).not.toHaveBeenCalled()

      expect(logger.info).toHaveBeenCalledWith(
        '[metadata-correction] No resolvable keyword corrections found',
        expect.objectContaining({
          collectionConceptId: 'C123-PROV',
          messageId: 'message-collection-2',
          nativeFormat: 'DIF10',
          keywordValidationFailureCount: 1
        })
      )
    })

    test('should apply fallback write values when optional corrected metadata details are missing', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C0000000001-KMS',
        providerId: 'PROV',
        nativeId: 'native-1',
        revisionId: 3,
        format: ' dif+xml ',
        umm: {
          ScienceKeywords: [
            {
              Category: 'EARTH SCIENCE',
              Topic: 'ATMOSPHERE',
              Term: 'LEGACY AEROSOLS'
            }
          ]
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
          ],
          warnings: []
        }
      })

      vi.mocked(extractKeywordValidationFailures).mockReturnValue([
        {
          scheme: 'sciencekeywords',
          path: ['ScienceKeywords', 0],
          oldKeyword: '[resolve old keyword from UMM-C value: EARTH SCIENCE|ATMOSPHERE|LEGACY AEROSOLS]',
          keywordValue: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'LEGACY AEROSOLS'
          },
          errors: ['Science keyword was not a valid keyword combination.']
        }
      ])

      vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
        keywordConceptUuid: 'science-uuid-1',
        oldKeywordObject: OLD_SCIENCE_KEYWORD_OBJECT,
        newKeywordObject: NEW_SCIENCE_KEYWORD_OBJECT,
        action: 'replace'
      })

      vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue('<DIF><Entry_ID/></DIF>')

      vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
        delegateName: 'dif10',
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
              collectionConceptId: 'C0000000001-KMS'
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
    test('should reject requests that omit the collection concept id', async () => {
      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-missing-concept-id',
            body: JSON.stringify({})
          }
        ]
      })).rejects.toThrow(
        'Incomplete metadata correction request: missing collectionConceptId'
      )

      expect(invokeMetadataCorrectionDelegate).not.toHaveBeenCalled()
    })

    test('should reject collection requests whose detected native format is unsupported', async () => {
      vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
        collectionConceptId: 'C123-UNKNOWN',
        providerId: 'PROV',
        nativeId: 'native-unknown',
        revisionId: 1,
        format: 'text/plain',
        umm: {
          ShortName: 'TEST'
        }
      })

      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-unknown-format',
            body: JSON.stringify({
              collectionConceptId: 'C123-UNKNOWN'
            })
          }
        ]
      })).rejects.toThrow('Unsupported native format: UNKNOWN')

      expect(validateCmrCollectionUmm).not.toHaveBeenCalled()
      expect(invokeMetadataCorrectionDelegate).not.toHaveBeenCalled()
    })

    test('should reject a missing record body as an incomplete request', async () => {
      await expect(metadataCorrectionService({
        Records: [
          {
            messageId: 'message-999'
          }
        ]
      })).rejects.toThrow(
        'Incomplete metadata correction request: missing collectionConceptId'
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
