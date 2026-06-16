import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { extractKeywordValidationFailures } from '@/shared/extractKeywordValidationFailures'
import { getCmrCollectionUmmDetails } from '@/shared/getCmrCollectionUmmDetails'
import { logger } from '@/shared/logger'
import { validateCmrCollectionUmm } from '@/shared/validateCmrCollectionUmm'

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
  invokeMetadataCorrectionDelegate: vi.fn()
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
      format: 'DIF+XML',
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
})
