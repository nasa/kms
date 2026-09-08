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
        }]
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
      includeDiff: undefined,
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
          }]
        }
      ],
      nextPaginationToken: null
    })
  })

  test('requests native metadata diffs in list results when requested', async () => {
    vi.mocked(getMetadataCorrectionAuditLog).mockResolvedValue({
      items: [],
      nextPaginationToken: null
    })

    await getMetadataCorrectionAudit({
      queryStringParameters: { includeDiff: 'true' }
    })

    expect(getMetadataCorrectionAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      includeDiff: 'true'
    }))
  })

  test('renders a compact html summary with detail links for browser requests', async () => {
    vi.mocked(getMetadataCorrectionAuditLog).mockResolvedValue({
      items: [{
        runId: 'run-html',
        collectionConceptId: 'C1234567890-LOCAL',
        status: 'applied',
        changes: [{
          scheme: 'platforms',
          action: 'UPDATED',
          oldKeywordPath: 'Platforms > GOSAT',
          newKeywordPath: 'Platforms > GOSAT - Test1'
        }]
      }],
      nextPaginationToken: 'next-token'
    })

    const result = await getMetadataCorrectionAudit({
      queryStringParameters: {
        collectionConceptId: 'C1234567890-LOCAL',
        format: 'html'
      }
    })

    expect(getMetadataCorrectionAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      collectionConceptId: 'C1234567890-LOCAL',
      includeDiff: undefined,
      limit: '10'
    }))

    expect(result.statusCode).toBe(200)
    expect(result.headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(result.headers['Cache-Control']).toBe('no-store')
    expect(result.body).toContain('<table class="changes-table">')
    expect(result.body).toContain('metadata_correction_audit/run-html?format=html')
    expect(result.body).not.toContain('Native metadata diff')
    expect(result.body).toContain('paginationToken=next-token')
  })

  test('renders one detailed audit document as html', async () => {
    vi.mocked(getMetadataCorrectionAuditByRunId).mockResolvedValue({
      runId: 'run-1',
      collectionConceptId: 'C123-PROV',
      providerId: 'PROV',
      priorRevisionId: 3,
      resultingRevisionId: 4,
      status: 'applied',
      corrections: [],
      statusHistory: [{
        status: 'applied',
        timestamp: '2026-09-08T12:00:00.000Z'
      }]
    })

    const result = await getMetadataCorrectionAudit({
      pathParameters: { runId: 'run-1' },
      queryStringParameters: { format: 'html' }
    })

    expect(getMetadataCorrectionAuditByRunId).toHaveBeenCalledWith({
      runId: 'run-1',
      includeDiff: true
    })

    expect(result.statusCode).toBe(200)
    expect(result.headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(result.body).toContain('Metadata correction audit detail')
    expect(result.body).toContain('Run details')
    expect(result.body).toContain('Prior CMR revision')
    expect(result.body).toContain('Lifecycle history')
    expect(result.body).toContain('Native metadata diff')
    expect(result.body).not.toContain('View details')
  })

  test('renders missing detail and server errors as html', async () => {
    vi.mocked(getMetadataCorrectionAuditByRunId).mockResolvedValue(null)

    const missingResult = await getMetadataCorrectionAudit({
      pathParameters: { runId: 'missing-run' },
      queryStringParameters: { format: 'html' }
    })

    expect(missingResult.statusCode).toBe(404)
    expect(missingResult.body).toContain('Metadata correction audit run not found: missing-run')

    vi.mocked(getMetadataCorrectionAuditLog).mockRejectedValue(new Error('DocumentDB unavailable'))

    const errorResult = await getMetadataCorrectionAudit({
      queryStringParameters: { format: 'html' }
    })

    expect(errorResult.statusCode).toBe(500)
    expect(errorResult.headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(errorResult.body).toContain('Error: DocumentDB unavailable')
  })

  test('returns 400 for an unsupported response format', async () => {
    const result = await getMetadataCorrectionAudit({
      queryStringParameters: { format: 'xml' }
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction audit format: expected json or html'
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
