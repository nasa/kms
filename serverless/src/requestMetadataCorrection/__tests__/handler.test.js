import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { logger } from '@/shared/logger'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'

import { requestMetadataCorrection } from '../handler'

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

vi.mock('@/shared/publishMetadataCorrectionRequest', () => ({
  publishMetadataCorrectionRequest: vi.fn()
}))

describe('requestMetadataCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 202 and publishes one deduplicated message per collection concept id', async () => {
    vi.mocked(publishMetadataCorrectionRequest)
      .mockResolvedValueOnce({
        messageId: 'message-1',
        messageGroupId: 'C123-PROV'
      })
      .mockResolvedValueOnce({
        messageId: 'message-2',
        messageGroupId: 'C456-PROV'
      })

    const result = await requestMetadataCorrection({
      body: JSON.stringify({
        collectionConceptIds: [
          'C123-PROV',
          ' C456-PROV ',
          'C123-PROV'
        ]
      })
    })

    expect(publishMetadataCorrectionRequest).toHaveBeenCalledTimes(2)
    expect(publishMetadataCorrectionRequest).toHaveBeenNthCalledWith(1, {
      source: 'metadataCorrectionApi',
      collectionConceptId: 'C123-PROV',
      requestedAt: expect.any(String)
    })

    expect(publishMetadataCorrectionRequest).toHaveBeenNthCalledWith(2, {
      source: 'metadataCorrectionApi',
      collectionConceptId: 'C456-PROV',
      requestedAt: expect.any(String)
    })

    expect(result.statusCode).toBe(202)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(result.headers['X-Custom-Header']).toBe('CustomValue')
    expect(JSON.parse(result.body)).toEqual({
      requestedCount: 3,
      acceptedCount: 2,
      accepted: [
        {
          collectionConceptId: 'C123-PROV',
          messageId: 'message-1',
          messageGroupId: 'C123-PROV'
        },
        {
          collectionConceptId: 'C456-PROV',
          messageId: 'message-2',
          messageGroupId: 'C456-PROV'
        }
      ]
    })
  })

  test('returns 400 when collectionConceptIds is missing', async () => {
    const result = await requestMetadataCorrection({
      body: JSON.stringify({})
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction request: collectionConceptIds must be an array'
    })

    expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
  })

  test('returns 400 when the request body is missing', async () => {
    const result = await requestMetadataCorrection({})

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction request: missing request body'
    })

    expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
  })

  test('returns 400 when the body is not valid json', async () => {
    const result = await requestMetadataCorrection({
      body: 'not-json'
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction request: body must be valid JSON'
    })

    expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
  })

  test('returns 400 when collectionConceptIds is empty', async () => {
    const result = await requestMetadataCorrection({
      body: JSON.stringify({
        collectionConceptIds: []
      })
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction request: collectionConceptIds must contain at least one value'
    })

    expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
  })

  test('returns 400 when a collectionConceptIds entry is blank', async () => {
    const result = await requestMetadataCorrection({
      body: JSON.stringify({
        collectionConceptIds: ['C123-PROV', '   ']
      })
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction request: collectionConceptIds[1] must be a non-empty string'
    })

    expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
  })

  test('returns 500 when publish fails and logs the error', async () => {
    vi.mocked(publishMetadataCorrectionRequest).mockRejectedValue(new Error('SNS unavailable'))

    const result = await requestMetadataCorrection({
      body: JSON.stringify({
        collectionConceptIds: ['C123-PROV']
      })
    })

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: SNS unavailable'
    })

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Failed asynchronous metadata correction request',
      expect.any(Error)
    )
  })

  test('returns 500 when a non-validation error has an empty message', async () => {
    vi.mocked(publishMetadataCorrectionRequest).mockRejectedValue(new Error(''))

    const result = await requestMetadataCorrection({
      body: JSON.stringify({
        collectionConceptIds: ['C123-PROV']
      })
    })

    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error'
    })
  })
})
