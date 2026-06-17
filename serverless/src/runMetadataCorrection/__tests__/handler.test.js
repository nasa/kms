import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'
import { runCollectionMetadataCorrection } from '@/shared/runCollectionMetadataCorrection'

import { runMetadataCorrection } from '../handler'

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: { 'X-Custom-Header': 'CustomValue' }
  }))
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/shared/runCollectionMetadataCorrection', () => ({
  runCollectionMetadataCorrection: vi.fn()
}))

describe('runMetadataCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns the synchronous correction summary as json', async () => {
    vi.mocked(runCollectionMetadataCorrection).mockResolvedValue({
      outcome: 'processed',
      collectionConceptId: 'C1234567890-PROV',
      nativeFormat: 'DIF10',
      keywordValidationFailureCount: 2,
      keywordValidationFailures: [
        {
          scheme: 'sciencekeywords'
        }
      ],
      resolvedCorrectionCount: 1,
      resolvedCorrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace'
        }
      ],
      correctionResult: {
        delegateName: 'dif10',
        correctionCount: 1
      },
      auditResults: {
        pending: {
          insertedCount: 1
        },
        applied: {
          insertedCount: 1
        }
      },
      writeResult: {
        ingestResult: {
          updated: true
        }
      },
      source: 'metadataCorrectionApi'
    })

    const result = await runMetadataCorrection({
      pathParameters: {
        collectionConceptId: 'C1234567890-PROV'
      }
    })

    expect(runCollectionMetadataCorrection).toHaveBeenCalledWith({
      collectionConceptId: 'C1234567890-PROV',
      source: 'metadataCorrectionApi'
    })

    expect(result.statusCode).toBe(200)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(result.headers['X-Custom-Header']).toBe('CustomValue')
    expect(JSON.parse(result.body)).toEqual({
      outcome: 'processed',
      collectionConceptId: 'C1234567890-PROV',
      nativeFormat: 'DIF10',
      keywordValidationFailureCount: 2,
      keywordValidationFailures: [
        {
          scheme: 'sciencekeywords'
        }
      ],
      resolvedCorrectionCount: 1,
      resolvedCorrections: [
        {
          scheme: 'sciencekeywords',
          action: 'replace'
        }
      ],
      correctionResult: {
        delegateName: 'dif10',
        correctionCount: 1
      },
      auditResults: {
        pending: {
          insertedCount: 1
        },
        applied: {
          insertedCount: 1
        }
      },
      writeResult: {
        ingestResult: {
          updated: true
        }
      },
      source: 'metadataCorrectionApi'
    })
  })

  test('decodes the path parameter before invoking the runner', async () => {
    vi.mocked(runCollectionMetadataCorrection).mockResolvedValue({
      outcome: 'no-keyword-issues'
    })

    await runMetadataCorrection({
      pathParameters: {
        collectionConceptId: 'C1234567890%2BPROV'
      }
    })

    expect(runCollectionMetadataCorrection).toHaveBeenCalledWith({
      collectionConceptId: 'C1234567890+PROV',
      source: 'metadataCorrectionApi'
    })
  })

  test('returns 400 for request-shape failures', async () => {
    vi.mocked(runCollectionMetadataCorrection).mockRejectedValue(
      new Error('Incomplete metadata correction request: missing collectionConceptId')
    )

    const result = await runMetadataCorrection({})

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Incomplete metadata correction request: missing collectionConceptId'
    })
  })

  test('returns 400 for unsupported native formats', async () => {
    vi.mocked(runCollectionMetadataCorrection).mockRejectedValue(
      new Error('Unsupported native format: UMM')
    )

    const result = await runMetadataCorrection({
      pathParameters: {
        collectionConceptId: 'C123-UMM'
      }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Unsupported native format: UMM'
    })
  })

  test('returns 500 for unexpected failures and logs them', async () => {
    vi.mocked(runCollectionMetadataCorrection).mockRejectedValue(
      new Error('something exploded')
    )

    const result = await runMetadataCorrection({
      pathParameters: {
        collectionConceptId: 'C1234567890-PROV'
      }
    })

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: something exploded'
    })

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Failed synchronous metadata correction request',
      expect.any(Error)
    )
  })

  test('returns 500 when the thrown value has no message field', async () => {
    vi.mocked(runCollectionMetadataCorrection).mockRejectedValue({})

    const result = await runMetadataCorrection({
      pathParameters: {
        collectionConceptId: 'C1234567890-PROV'
      }
    })

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: '[object Object]'
    })
  })
})
