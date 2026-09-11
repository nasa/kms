import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { getVersionMetadata } from '@/shared/getVersionMetadata'
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

vi.mock('@/shared/getVersionMetadata', () => ({
  getVersionMetadata: vi.fn()
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
    vi.mocked(getVersionMetadata).mockResolvedValue({ versionName: '20.1' })
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
      publishedVersionName: '20.1',
      requestedAt: expect.any(String)
    })

    expect(publishMetadataCorrectionRequest).toHaveBeenNthCalledWith(2, {
      source: 'metadataCorrectionApi',
      collectionConceptId: 'C456-PROV',
      publishedVersionName: '20.1',
      requestedAt: expect.any(String)
    })

    expect(result.statusCode).toBe(202)
    expect(result.headers['Content-Type']).toBe('application/json')
    expect(result.headers['X-Custom-Header']).toBe('CustomValue')
    expect(JSON.parse(result.body)).toEqual({
      requestedCount: 3,
      acceptedCount: 2,
      failedCount: 0,
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
      ],
      failed: []
    })
  })

  test('returns 202 with accepted and failed publish results when only part of the batch publishes', async () => {
    vi.mocked(publishMetadataCorrectionRequest)
      .mockResolvedValueOnce({
        messageId: 'message-1',
        messageGroupId: 'C123-PROV'
      })
      .mockRejectedValueOnce(new Error('SNS unavailable'))

    const result = await requestMetadataCorrection({
      body: JSON.stringify({
        collectionConceptIds: [
          'C123-PROV',
          'C456-PROV'
        ]
      })
    })

    expect(result.statusCode).toBe(202)
    expect(JSON.parse(result.body)).toEqual({
      requestedCount: 2,
      acceptedCount: 1,
      failedCount: 1,
      accepted: [
        {
          collectionConceptId: 'C123-PROV',
          messageId: 'message-1',
          messageGroupId: 'C123-PROV'
        }
      ],
      failed: [
        {
          collectionConceptId: 'C456-PROV',
          error: 'Error: SNS unavailable'
        }
      ]
    })

    expect(logger.error).toHaveBeenCalledWith(
      '[metadata-correction] Partially failed asynchronous metadata correction request',
      expect.objectContaining({
        requestedCount: 2,
        acceptedCount: 1,
        failedCount: 1
      })
    )
  })

  test('returns 202 and stringifies non-Error publish failures in partial batch results', async () => {
    vi.mocked(publishMetadataCorrectionRequest)
      .mockResolvedValueOnce({
        messageId: 'message-1',
        messageGroupId: 'C123-PROV'
      })
      .mockRejectedValueOnce('SNS unavailable')

    const result = await requestMetadataCorrection({
      body: JSON.stringify({
        collectionConceptIds: [
          'C123-PROV',
          'C456-PROV'
        ]
      })
    })

    expect(result.statusCode).toBe(202)
    expect(JSON.parse(result.body)).toEqual({
      requestedCount: 2,
      acceptedCount: 1,
      failedCount: 1,
      accepted: [
        {
          collectionConceptId: 'C123-PROV',
          messageId: 'message-1',
          messageGroupId: 'C123-PROV'
        }
      ],
      failed: [
        {
          collectionConceptId: 'C456-PROV',
          error: 'SNS unavailable'
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

  test('returns 400 when the body is literal null', async () => {
    const result = await requestMetadataCorrection({
      body: 'null'
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction request: body must be a JSON object'
    })

    expect(publishMetadataCorrectionRequest).not.toHaveBeenCalled()
  })

  test('returns 400 when the body is a json array', async () => {
    const result = await requestMetadataCorrection({
      body: '[]'
    })

    expect(result.statusCode).toBe(400)
    expect(JSON.parse(result.body)).toEqual({
      error: 'Error: Invalid metadata correction request: body must be a JSON object'
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
