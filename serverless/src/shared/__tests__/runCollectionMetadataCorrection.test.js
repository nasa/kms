import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { detectNativeMetadataFormat } from '@/shared/detectNativeMetadataFormat'
import { extractKeywordValidationFailures } from '@/shared/extractKeywordValidationFailures'
import { getCmrCollectionNativeMetadata } from '@/shared/getCmrCollectionNativeMetadata'
import { getCmrCollectionUmmDetails } from '@/shared/getCmrCollectionUmmDetails'
import { invokeMetadataCorrectionDelegate } from '@/shared/invokeMetadataCorrectionDelegate'
import { logger } from '@/shared/logger'
import { persistMetadataCorrectionAuditLog } from '@/shared/persistMetadataCorrectionAuditLog'
import { resolveOldKeywordConceptUuid } from '@/shared/resolveOldKeywordConceptUuid'
import { validateCmrCollectionUmm } from '@/shared/validateCmrCollectionUmm'
import { writeCorrectedMetadataToCmr } from '@/shared/writeCorrectedMetadataToCmr'

import { runCollectionMetadataCorrection } from '../runCollectionMetadataCorrection'

vi.mock('@/shared/detectNativeMetadataFormat', () => ({
  detectNativeMetadataFormat: vi.fn(() => 'DIF10')
}))

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
  invokeMetadataCorrectionDelegate: vi.fn(),
  isMetadataCorrectionDelegateSupported: vi.fn((nativeFormat) => (
    nativeFormat === 'DIF10'
    || (
      nativeFormat === 'UMM'
      && (
        String(process.env.USE_LOCALSTACK || '').toLowerCase() === 'true'
        || String(process.env.useLocalstack || '').toLowerCase() === 'true'
      )
    )
  ))
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn()
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

describe('runCollectionMetadataCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.USE_LOCALSTACK
    delete process.env.useLocalstack
  })

  test('throws when invoked without arguments', async () => {
    await expect(runCollectionMetadataCorrection()).rejects.toThrow(
      'Incomplete metadata correction request: missing collectionConceptId'
    )
  })

  test('uses the default source when a collection has no keyword issues', async () => {
    vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
      collectionConceptId: 'C1234567890-PROV',
      providerId: 'PROV',
      nativeId: 'native-123',
      revisionId: 7,
      format: 'application/dif10+xml',
      umm: {}
    })

    vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
      status: 200,
      errors: [],
      warnings: [],
      responseBody: {
        errors: [],
        warnings: []
      }
    })

    vi.mocked(extractKeywordValidationFailures).mockReturnValue([])

    await expect(runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV'
    })).resolves.toEqual({
      outcome: 'no-keyword-issues',
      collectionConceptId: 'C1234567890-PROV',
      providerId: 'PROV',
      nativeId: 'native-123',
      revisionId: 7,
      nativeFormat: 'DIF10',
      keywordValidationFailureCount: 0,
      keywordValidationFailures: [],
      resolvedCorrectionCount: 0,
      resolvedCorrections: [],
      correctionResult: null,
      auditResults: {
        pending: null,
        applied: null
      },
      writeResult: null,
      source: 'metadataCorrectionService'
    })

    expect(logger.info).toHaveBeenCalledWith(
      '[metadata-correction] No resolvable keyword corrections found',
      expect.objectContaining({
        collectionConceptId: 'C1234567890-PROV',
        nativeFormat: 'DIF10',
        keywordValidationFailureCount: 0
      })
    )
  })

  test('marks audit actions as MANUAL for the synchronous concept-id correction flow', async () => {
    vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
      collectionConceptId: 'C1234567890-PROV',
      providerId: 'PROV',
      nativeId: 'native-123',
      revisionId: 7,
      format: 'application/dif10+xml',
      umm: {}
    })

    vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
      status: 200,
      errors: ['invalid keyword'],
      warnings: [],
      responseBody: {
        errors: ['invalid keyword'],
        warnings: []
      }
    })

    vi.mocked(extractKeywordValidationFailures).mockReturnValue([
      {
        scheme: 'sciencekeywords',
        path: ['ScienceKeywords', 0],
        keywordValue: {
          Category: 'EARTH SCIENCE',
          Topic: 'ATMOSPHERE',
          Term: 'AEROSOLS',
          VariableLevel1: 'LEGACY AEROSOLS'
        }
      }
    ])

    vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
      keywordConceptUuid: 'uuid-1',
      oldKeywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: 'LEGACY AEROSOLS',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      },
      newKeywordObject: {
        Category: 'EARTH SCIENCE',
        Topic: 'ATMOSPHERE',
        Term: 'AEROSOLS',
        VariableLevel1: '',
        VariableLevel2: '',
        VariableLevel3: '',
        DetailedVariable: ''
      },
      action: 'replace'
    })

    vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue('<DIF/>')

    vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
      delegateName: 'dif10',
      nativeFormat: 'DIF10',
      correctionCount: 1,
      correctionsApplied: [
        {
          scheme: 'sciencekeywords',
          keywordConceptUuid: 'uuid-1',
          oldKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: 'LEGACY AEROSOLS',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          },
          newKeywordObject: {
            Category: 'EARTH SCIENCE',
            Topic: 'ATMOSPHERE',
            Term: 'AEROSOLS',
            VariableLevel1: '',
            VariableLevel2: '',
            VariableLevel3: '',
            DetailedVariable: ''
          }
        }
      ],
      correctedMetadata: '<DIF>corrected</DIF>'
    })

    vi.mocked(persistMetadataCorrectionAuditLog)
      .mockResolvedValueOnce({
        insertedCount: 1,
        publishedVersionName: 'published',
        status: 'pending'
      })
      .mockResolvedValueOnce({
        insertedCount: 1,
        publishedVersionName: 'published',
        status: 'applied'
      })

    vi.mocked(writeCorrectedMetadataToCmr).mockResolvedValue({
      ingestResult: {
        updated: true
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV',
      source: 'metadataCorrectionApi'
    })

    expect(persistMetadataCorrectionAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        keywordEvent: {
          eventType: 'MANUAL'
        },
        status: 'pending'
      })
    )

    expect(persistMetadataCorrectionAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        keywordEvent: {
          eventType: 'MANUAL'
        },
        status: 'applied'
      })
    )
  })

  test('passes the exact fetched UMM content type through to writeback in local UMM mode', async () => {
    process.env.USE_LOCALSTACK = 'true'

    vi.mocked(detectNativeMetadataFormat).mockReturnValue('UMM')
    vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
      collectionConceptId: 'C1234567890-PROV',
      providerId: 'PROV',
      nativeId: 'native-123',
      revisionId: 7,
      format: 'application/vnd.nasa.cmr.umm+json',
      umm: {
        ShortName: 'TEST'
      }
    })

    vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
      status: 200,
      errors: ['invalid keyword'],
      warnings: [],
      responseBody: {
        errors: ['invalid keyword'],
        warnings: []
      }
    })

    vi.mocked(extractKeywordValidationFailures).mockReturnValue([
      {
        scheme: 'sciencekeywords',
        path: ['ScienceKeywords', 0],
        keywordValue: {
          Category: 'EARTH SCIENCE'
        }
      }
    ])

    vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
      keywordConceptUuid: 'uuid-1',
      oldKeywordObject: {
        Category: 'EARTH SCIENCE'
      },
      newKeywordObject: {
        Category: 'EARTH SCIENCE - UPDATED'
      },
      action: 'replace'
    })

    vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue({
      metadataPayload: {
        ShortName: 'TEST'
      },
      contentType: 'application/vnd.nasa.cmr.umm+json;version=1.16.2; charset=utf-8'
    })

    vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
      delegateName: 'umm',
      nativeFormat: 'UMM',
      correctionCount: 1,
      correctionsApplied: [
        {
          scheme: 'sciencekeywords',
          keywordConceptUuid: 'uuid-1'
        }
      ],
      correctedMetadata: {
        ShortName: 'TEST-UPDATED'
      }
    })

    vi.mocked(persistMetadataCorrectionAuditLog)
      .mockResolvedValueOnce({
        insertedCount: 1,
        publishedVersionName: 'published',
        status: 'pending'
      })
      .mockResolvedValueOnce({
        insertedCount: 1,
        publishedVersionName: 'published',
        status: 'applied'
      })

    vi.mocked(writeCorrectedMetadataToCmr).mockResolvedValue({
      ingestResult: {
        updated: true
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV'
    })

    expect(getCmrCollectionNativeMetadata).toHaveBeenCalledWith({
      collectionConceptId: 'C1234567890-PROV',
      revisionId: 7,
      includeResponseMetadata: true
    })

    expect(invokeMetadataCorrectionDelegate).toHaveBeenCalledWith(expect.objectContaining({
      nativeFormat: 'UMM',
      metadataPayload: {
        ShortName: 'TEST'
      }
    }))

    expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
      nativeFormat: 'UMM',
      nativeMetadataContentType: 'application/vnd.nasa.cmr.umm+json;version=1.16.2; charset=utf-8'
    }))
  })

  test('falls back to an empty native metadata content type for non-UMM records when collection format is missing', async () => {
    vi.mocked(detectNativeMetadataFormat).mockReturnValue('DIF10')

    vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
      collectionConceptId: 'C1234567890-PROV',
      providerId: 'PROV',
      nativeId: 'native-123',
      revisionId: 7,
      umm: {}
    })

    vi.mocked(validateCmrCollectionUmm).mockResolvedValue({
      status: 200,
      errors: ['invalid keyword'],
      warnings: [],
      responseBody: {
        errors: ['invalid keyword'],
        warnings: []
      }
    })

    vi.mocked(extractKeywordValidationFailures).mockReturnValue([
      {
        scheme: 'sciencekeywords',
        path: ['ScienceKeywords', 0],
        keywordValue: {
          Category: 'EARTH SCIENCE'
        }
      }
    ])

    vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
      keywordConceptUuid: 'uuid-1',
      oldKeywordObject: {
        Category: 'EARTH SCIENCE'
      },
      newKeywordObject: {
        Category: 'EARTH SCIENCE - UPDATED'
      },
      action: 'replace'
    })

    vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue('<DIF/>')

    vi.mocked(invokeMetadataCorrectionDelegate).mockResolvedValue({
      delegateName: 'dif10',
      nativeFormat: 'DIF10',
      correctionCount: 1,
      correctionsApplied: [
        {
          scheme: 'sciencekeywords',
          keywordConceptUuid: 'uuid-1'
        }
      ],
      correctedMetadata: '<DIF>corrected</DIF>'
    })

    vi.mocked(persistMetadataCorrectionAuditLog)
      .mockResolvedValueOnce({
        insertedCount: 1,
        publishedVersionName: 'published',
        status: 'pending'
      })
      .mockResolvedValueOnce({
        insertedCount: 1,
        publishedVersionName: 'published',
        status: 'applied'
      })

    vi.mocked(writeCorrectedMetadataToCmr).mockResolvedValue({
      ingestResult: {
        updated: true
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV'
    })

    expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
      nativeFormat: 'DIF10',
      nativeMetadataContentType: ''
    }))
  })

  test('rejects DIF9 until a dedicated DIF9 delegate exists', async () => {
    vi.mocked(detectNativeMetadataFormat).mockReturnValue('DIF9')
    vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
      collectionConceptId: 'C1234567890-PROV',
      providerId: 'PROV',
      nativeId: 'native-123',
      revisionId: 7,
      format: 'application/dif+xml',
      umm: {}
    })

    await expect(runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV'
    })).rejects.toThrow('Unsupported native format: DIF9')

    expect(validateCmrCollectionUmm).not.toHaveBeenCalled()
    expect(getCmrCollectionNativeMetadata).not.toHaveBeenCalled()
    expect(invokeMetadataCorrectionDelegate).not.toHaveBeenCalled()
    expect(writeCorrectedMetadataToCmr).not.toHaveBeenCalled()
  })
})
