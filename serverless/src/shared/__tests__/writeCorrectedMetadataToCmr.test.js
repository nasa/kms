import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrPutRequest } from '../cmrPutRequest'
import { getCmrSystemToken } from '../getCmrSystemToken'
import { writeCorrectedMetadataToCmr } from '../writeCorrectedMetadataToCmr'

vi.mock('../cmrPutRequest', () => ({
  cmrPutRequest: vi.fn()
}))

vi.mock('../getCmrSystemToken', () => ({
  getCmrSystemToken: vi.fn()
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn()
  }
}))

describe('when writing corrected metadata to cmr', () => {
  const createResponse = ({
    ok = true,
    status = 200,
    statusText = 'OK',
    body = {
      'concept-id': 'C0000000000-KMS',
      'revision-id': 2
    },
    url = 'https://cmr-test.earthdata.nasa.gov/ingest/providers/KMS/collections/native-1'
  } = {}) => ({
    ok,
    status,
    statusText,
    url,
    text: vi.fn().mockResolvedValue(
      typeof body === 'string' ? body : JSON.stringify(body)
    )
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CMR_WRITEBACK_PROVIDERS = 'KMS'
    delete process.env.CMR_UMM_JSON_VERSION

    vi.mocked(getCmrSystemToken).mockResolvedValue('system-token')
    vi.mocked(cmrPutRequest).mockResolvedValue(createResponse())
  })

  test('should write DIF10 corrected metadata to CMR ingest when the provider is enabled', async () => {
    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 2,
      correctionsApplied: [{ scheme: 'sciencekeywords' }, { scheme: 'platforms' }],
      correctedMetadata: '<DIF><Entry_ID/></DIF>',
      source: 'metadataCorrectionService'
    })

    expect(result).toEqual({
      stubbed: false,
      targetComponent: 'cmr-writeback',
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 2,
      correctionsAppliedCount: 2,
      correctedMetadataBytes: Buffer.byteLength('<DIF><Entry_ID/></DIF>', 'utf8'),
      source: 'metadataCorrectionService',
      ingestResult: {
        enabled: true,
        ingested: true,
        updated: true,
        stubbed: false,
        status: 200,
        conceptId: 'C0000000000-KMS',
        revisionId: 2,
        responseBody: {
          'concept-id': 'C0000000000-KMS',
          'revision-id': 2
        }
      }
    })

    expect(getCmrSystemToken).toHaveBeenCalledTimes(1)
    expect(cmrPutRequest).toHaveBeenCalledWith({
      path: '/ingest/providers/KMS/collections/native-1',
      body: '<DIF><Entry_ID/></DIF>',
      contentType: 'application/dif10+xml',
      accept: 'application/json',
      headers: {
        Authorization: 'Bearer system-token'
      }
    })
  })

  test('should return a disabled summary when writeback is not enabled for the provider', async () => {
    process.env.CMR_WRITEBACK_PROVIDERS = 'OTHER'

    const result = await writeCorrectedMetadataToCmr()

    expect(result).toEqual({
      stubbed: false,
      targetComponent: 'cmr-writeback',
      collectionConceptId: null,
      providerId: null,
      nativeId: null,
      nativeFormat: null,
      correctionCount: 0,
      correctionsAppliedCount: 0,
      correctedMetadataBytes: 0,
      source: null,
      ingestResult: {
        enabled: false,
        ingested: false,
        updated: false,
        stubbed: false
      }
    })

    expect(getCmrSystemToken).not.toHaveBeenCalled()
    expect(cmrPutRequest).not.toHaveBeenCalled()
  })

  test('should treat non-array applied corrections as zero applied corrections', async () => {
    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctedMetadata: '<DIF><Entry_ID/></DIF>',
      correctionCount: 1,
      correctionsApplied: {
        scheme: 'sciencekeywords'
      }
    })

    expect(result.correctionsAppliedCount).toBe(0)
  })

  test('should serialize object corrected metadata and use the versioned UMM content type', async () => {
    process.env.CMR_WRITEBACK_PROVIDERS = 'ALL'
    process.env.CMR_UMM_JSON_VERSION = '1.18.5'

    const correctedMetadata = {
      ShortName: 'UPDATED'
    }

    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C1234567890-LOCAL',
      providerId: 'LOCAL',
      nativeId: 'native-umm-1',
      nativeFormat: 'UMM',
      correctionCount: 1,
      correctedMetadata
    })

    expect(result.correctedMetadataBytes).toBe(
      Buffer.byteLength(JSON.stringify(correctedMetadata), 'utf8')
    )

    expect(cmrPutRequest).toHaveBeenCalledWith({
      path: '/ingest/providers/LOCAL/collections/native-umm-1',
      body: JSON.stringify(correctedMetadata),
      contentType: 'application/vnd.nasa.cmr.umm+json;version=1.18.5',
      accept: 'application/json',
      headers: {
        Authorization: 'Bearer system-token'
      }
    })
  })

  test('should treat null corrected metadata as an empty serialized payload for byte counting', async () => {
    process.env.CMR_WRITEBACK_PROVIDERS = 'OTHER'

    const result = await writeCorrectedMetadataToCmr({
      correctedMetadata: null
    })

    expect(result.correctedMetadataBytes).toBe(
      Buffer.byteLength(JSON.stringify(''), 'utf8')
    )
  })

  test('should fall back to zero bytes when corrected metadata cannot be serialized and writeback is disabled', async () => {
    process.env.CMR_WRITEBACK_PROVIDERS = 'OTHER'

    const correctedMetadata = {}
    correctedMetadata.self = correctedMetadata

    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
      correctedMetadata
    })

    expect(result.correctedMetadataBytes).toBe(0)
    expect(cmrPutRequest).not.toHaveBeenCalled()
  })

  test('should skip enabled writeback when no corrections were applied', async () => {
    const result = await writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 0,
      correctedMetadata: '<DIF><Entry_ID/></DIF>'
    })

    expect(result.ingestResult).toEqual({
      enabled: true,
      ingested: false,
      updated: false,
      stubbed: false
    })

    expect(getCmrSystemToken).not.toHaveBeenCalled()
    expect(cmrPutRequest).not.toHaveBeenCalled()
  })

  test('should throw when enabled writeback is missing routing fields', async () => {
    await expect(writeCorrectedMetadataToCmr({
      providerId: 'KMS',
      correctedMetadata: '<DIF><Entry_ID/></DIF>',
      correctionCount: 1
    })).rejects.toThrow(
      'Incomplete CMR writeback request: missing collectionConceptId/providerId/nativeId/nativeFormat'
    )
  })

  test('should throw when enabled writeback is missing corrected metadata', async () => {
    await expect(writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 1,
      correctedMetadata: null
    })).rejects.toThrow('Missing corrected metadata payload for CMR writeback')
  })

  test('should surface CMR ingest failures', async () => {
    vi.mocked(cmrPutRequest).mockResolvedValue(createResponse({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      body: {
        errors: ['boom']
      }
    }))

    await expect(writeCorrectedMetadataToCmr({
      collectionConceptId: 'C0000000000-KMS',
      providerId: 'KMS',
      nativeId: 'native-1',
      nativeFormat: 'DIF10',
      correctionCount: 1,
      correctedMetadata: '<DIF><Entry_ID/></DIF>'
    })).rejects.toThrow('CMR writeback failed with status 400')
  })
})
