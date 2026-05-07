import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getMetadataCorrectionAuditLog } from '@/shared/getMetadataCorrectionAuditLog'

import { getMetadataCorrectionAudit } from '../handler'

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn(() => ({
    defaultResponseHeaders: { 'X-Custom-Header': 'CustomValue' }
  }))
}))

vi.mock('@/shared/getMetadataCorrectionAuditLog', () => ({
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

  test('returns audit rows as json', async () => {
    vi.mocked(getMetadataCorrectionAuditLog).mockResolvedValue([
      {
        recordUri: 'https://example.org/audit/1',
        collectionConceptId: 'C1234567890-LOCAL',
        action: 'UPDATED'
      }
    ])

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
      scheme: undefined,
      status: undefined,
      limit: '10'
    })

    expect(result.statusCode).toBe(200)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(result.headers['X-Custom-Header']).toBe('CustomValue')
    expect(JSON.parse(result.body)).toEqual({
      items: [
        {
          recordUri: 'https://example.org/audit/1',
          collectionConceptId: 'C1234567890-LOCAL',
          action: 'UPDATED'
        }
      ]
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
})
