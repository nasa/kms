import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { detectNativeMetadataFormat } from '@/shared/detectNativeMetadataFormat'
import { CONSUMER_METRIC_NAMES } from '@/shared/emitConsumerMetrics'
import { emitConsumerMetricsSafely } from '@/shared/emitConsumerMetricsSafely'
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
    || nativeFormat === 'UMM'
  ))
}))

vi.mock('@/shared/emitConsumerMetrics', () => ({
  CONSUMER_METRIC_NAMES: {
    EVENTS_CONSUMED: 'EventsConsumed',
    EVENTS_PROCESSED: 'EventsProcessed',
    EVENT_PROCESSING_FAILURES: 'EventProcessingFailures',
    RECORDS_UPDATED_FROM_EVENT: 'RecordsUpdatedFromEvent',
    RECORDS_UPDATED_FROM_MANUAL: 'RecordsUpdatedFromManual',
    INVALID_KEYWORD_COUNT: 'InvalidKeywordCount',
    CORRECTIONS_APPLIED_TO_METADATA: 'CorrectionsAppliedToMetadata',
    CORRECTIONS_WRITTEN_TO_CMR: 'CorrectionsWrittenToCMR',
    KEYWORDS_RESOLVED: 'KeywordsResolved'
  },
  emitConsumerMetrics: vi.fn()
}))

vi.mock('@/shared/emitConsumerMetricsSafely', () => ({
  emitConsumerMetricsSafely: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
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

describe('runCollectionMetadataCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
          value: 0
        },
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
          value: 0
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 0
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics'
    }))

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
        enabled: true,
        updated: true
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV',
      source: 'metadataCorrectionApi'
    })

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_WRITTEN_TO_CMR,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_MANUAL,
          value: 1
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics'
    }))

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

  test('emits no-op run metrics for the synchronous concept-id correction flow', async () => {
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
      collectionConceptId: 'C1234567890-PROV',
      source: 'metadataCorrectionApi'
    })).resolves.toEqual(expect.objectContaining({
      outcome: 'no-keyword-issues'
    }))

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
          value: 0
        },
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
          value: 0
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 0
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics'
    }))
  })

  test('passes the exact fetched UMM content type through to writeback', async () => {
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
        enabled: true,
        updated: true
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV',
      source: 'metadataCorrectionApi'
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

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_WRITTEN_TO_CMR,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_MANUAL,
          value: 1
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics'
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

  test('does not emit record-update metrics when corrections are applied but writeback is disabled', async () => {
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

    vi.mocked(persistMetadataCorrectionAuditLog).mockResolvedValue({
      insertedCount: 1,
      publishedVersionName: 'published',
      status: 'pending'
    })

    vi.mocked(writeCorrectedMetadataToCmr).mockResolvedValue({
      ingestResult: {
        enabled: false,
        ingested: false,
        updated: false
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV',
      keywordEvent: {
        eventType: 'UPDATED',
        scheme: 'sciencekeywords',
        uuid: 'uuid-1'
      }
    })

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 1
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics'
    }))
  })

  test('emits direct update metrics for keyword-event-driven corrections', async () => {
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
        enabled: true,
        updated: true
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV',
      keywordEvent: {
        eventType: 'UPDATED',
        scheme: 'sciencekeywords',
        uuid: 'uuid-1'
      }
    })

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_WRITTEN_TO_CMR,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_EVENT,
          value: 1
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics'
    }))
  })

  test('emits deleted-action record update metrics when a deleted keyword event writes successfully', async () => {
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
          Category: 'EARTH SCIENCE'
        }
      }
    ])

    vi.mocked(resolveOldKeywordConceptUuid).mockResolvedValue({
      keywordConceptUuid: 'uuid-1',
      oldKeywordObject: {
        Category: 'EARTH SCIENCE'
      },
      newKeywordObject: {},
      action: 'delete'
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
        enabled: true,
        updated: true
      }
    })

    await runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV',
      keywordEvent: {
        eventType: 'DELETED',
        scheme: 'sciencekeywords',
        uuid: 'uuid-1'
      }
    })

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      metrics: [
        {
          metricName: CONSUMER_METRIC_NAMES.INVALID_KEYWORD_COUNT,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.KEYWORDS_RESOLVED,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_APPLIED_TO_METADATA,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.CORRECTIONS_WRITTEN_TO_CMR,
          value: 1
        },
        {
          metricName: CONSUMER_METRIC_NAMES.RECORDS_UPDATED_FROM_EVENT,
          value: 1
        }
      ],
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics'
    }))
  })

  test('logs and continues when correction-run metric emission fails', async () => {
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
    vi.mocked(emitConsumerMetricsSafely).mockResolvedValueOnce(undefined)

    await expect(runCollectionMetadataCorrection({
      collectionConceptId: 'C1234567890-PROV'
    })).resolves.toEqual(expect.objectContaining({
      outcome: 'no-keyword-issues'
    }))

    expect(emitConsumerMetricsSafely).toHaveBeenCalledWith(expect.objectContaining({
      errorLogMessage: '[metadata-correction] Failed to emit correction-run metrics',
      logContext: expect.objectContaining({
        collectionConceptId: 'C1234567890-PROV',
        source: 'metadataCorrectionService'
      })
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
