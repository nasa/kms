import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import {
  getMetadataCorrectionAuditByRunId,
  getMetadataCorrectionAuditLog
} from '@/shared/getMetadataCorrectionAuditLog'

import { getMetadataCorrectionAudit } from '../handler'

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: { 'X-Custom-Header': 'CustomValue' }
  }))
}))

vi.mock('@/shared/getMetadataCorrectionAuditLog', () => ({
  getMetadataCorrectionAuditByRunId: vi.fn(),
  getMetadataCorrectionAuditLog: vi.fn()
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

describe('getMetadataCorrectionAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns audit documents as json', async () => {
    vi.mocked(getMetadataCorrectionAuditLog).mockResolvedValue({
      items: [{
        runId: 'run-1',
        collectionConceptId: 'C1234567890-LOCAL',
        collectionUri: 'https://cmr.example.com/search/concepts/C1234567890-LOCAL',
        status: 'applied',
        changes: [{
          scheme: 'platforms',
          oldKeywordPath: 'Platforms > GOSAT',
          newKeywordPath: 'Platforms > GOSAT - Test1'
        }],
        hasMetadataDiff: true
      }],
      nextPaginationToken: null
    })

    const result = await getMetadataCorrectionAudit({
      queryStringParameters: {
        collectionConceptId: 'C1234567890-LOCAL',
        limit: '10'
      }
    })

    expect(getMetadataCorrectionAuditLog).toHaveBeenCalledWith({
      collectionConceptId: 'C1234567890-LOCAL',
      keywordConceptUuid: undefined,
      action: undefined,
      paginationToken: undefined,
      endDate: undefined,
      scheme: undefined,
      status: undefined,
      nativeFormat: undefined,
      publishedVersionName: undefined,
      source: undefined,
      startDate: undefined,
      limit: '10'
    })

    expect(result.statusCode).toBe(200)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(result.headers['X-Custom-Header']).toBe('CustomValue')
    expect(JSON.parse(result.body)).toEqual({
      items: [
        {
          runId: 'run-1',
          collectionConceptId: 'C1234567890-LOCAL',
          collectionUri: 'https://cmr.example.com/search/concepts/C1234567890-LOCAL',
          status: 'applied',
          changes: [{
            scheme: 'platforms',
            oldKeywordPath: 'Platforms > GOSAT',
            newKeywordPath: 'Platforms > GOSAT - Test1'
          }],
          hasMetadataDiff: true
        }
      ],
      nextPaginationToken: null
    })
  })

  test('returns 500 when the audit query fails', async () => {
    vi.mocked(getMetadataCorrectionAuditLog).mockRejectedValue(new Error('Audit query failed'))

    const result = await getMetadataCorrectionAudit({})

    expect(result.statusCode).toBe(500)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Audit query failed'
    })
  })

  test('returns 400 for invalid filters', async () => {
    vi.mocked(getMetadataCorrectionAuditLog).mockRejectedValue(
      new Error('Invalid metadata correction audit paginationToken')
    )

    const result = await getMetadataCorrectionAudit({})

    expect(result.statusCode).toBe(400)
  })

  test('returns one detailed audit document with its native metadata diff', async () => {
    vi.mocked(getMetadataCorrectionAuditByRunId).mockResolvedValue({
      runId: 'run-1',
      status: 'applied',
      metadataDiff: {
        changed: true,
        patch: '-old\n+new'
      }
    })

    const result = await getMetadataCorrectionAudit({
      pathParameters: { runId: 'run-1' },
      queryStringParameters: { includeDiff: 'true' }
    })

    expect(getMetadataCorrectionAuditByRunId).toHaveBeenCalledWith({
      runId: 'run-1',
      includeDiff: 'true'
    })
    expect(getMetadataCorrectionAuditLog).not.toHaveBeenCalled()
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body).metadataDiff.patch).toBe('-old\n+new')
  })

  test('returns 404 when a detailed audit run does not exist', async () => {
    vi.mocked(getMetadataCorrectionAuditByRunId).mockResolvedValue(null)

    const result = await getMetadataCorrectionAudit({
      pathParameters: { runId: 'missing-run' }
    })

    expect(result.statusCode).toBe(404)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Metadata correction audit run not found: missing-run'
    })
  })

  test('returns 400 when the detail diff flag is invalid', async () => {
    vi.mocked(getMetadataCorrectionAuditByRunId).mockRejectedValue(
      new Error('Invalid metadata correction audit includeDiff: expected true or false')
    )

    const result = await getMetadataCorrectionAudit({
      pathParameters: { runId: 'run-1' },
      queryStringParameters: { includeDiff: 'yes' }
    })

    expect(result.statusCode).toBe(400)
  })
})
