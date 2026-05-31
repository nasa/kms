import {
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { primeConceptsCache } from '@/primeConceptsCache/handler'
import { rebuildRedisCache, requestRebuildRedisCache } from '@/rebuildRedisCache/handler'
import { getEventBridgeClient } from '@/shared/awsClients'
import { buildHistoricalConceptCache } from '@/shared/buildHistoricalConceptCache'
import { exportPublishSchemeCsvToS3 } from '@/shared/exportPublishSchemeCsvToS3'
import { getApplicationConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'
import { getRedisClient } from '@/shared/redisCacheStore'

const { sendEventBridgeMock, PutEventsCommandMock } = vi.hoisted(() => ({
  sendEventBridgeMock: vi.fn(),
  PutEventsCommandMock: vi.fn((input) => input)
}))

vi.mock('@/shared/awsClients', () => ({
  getEventBridgeClient: vi.fn(() => ({
    send: sendEventBridgeMock
  }))
}))

vi.mock('@/shared/buildHistoricalConceptCache', () => ({
  buildHistoricalConceptCache: vi.fn()
}))

vi.mock('@/shared/exportPublishSchemeCsvToS3', () => ({
  exportPublishSchemeCsvToS3: vi.fn()
}))

vi.mock('@/shared/getConfig', () => ({
  getApplicationConfig: vi.fn()
}))

vi.mock('@/shared/logAnalyticsData', () => ({
  logAnalyticsData: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn()
  }
}))

vi.mock('@/primeConceptsCache/handler', () => ({
  primeConceptsCache: vi.fn()
}))

vi.mock('@/shared/redisCacheStore', () => ({
  getRedisClient: vi.fn()
}))

vi.mock('@aws-sdk/client-eventbridge', () => ({
  PutEventsCommand: PutEventsCommandMock
}))

describe('when requestRebuildRedisCache is invoked', () => {
  const defaultResponseHeaders = { 'Access-Control-Allow-Origin': '*' }
  const event = {}
  const context = {}

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getApplicationConfig).mockReturnValue({
      defaultResponseHeaders
    })

    vi.mocked(getEventBridgeClient).mockReturnValue({
      send: sendEventBridgeMock
    })

    sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 0 })
  })

  describe('when successful', () => {
    test('should emit an EventBridge event and return 202', async () => {
      const response = await requestRebuildRedisCache(event, context)

      expect(response).toEqual({
        statusCode: 202,
        headers: defaultResponseHeaders,
        body: JSON.stringify({
          message: 'Redis cache rebuild initiated'
        })
      })

      expect(sendEventBridgeMock).toHaveBeenCalledTimes(1)
      expect(PutEventsCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({
          Entries: expect.arrayContaining([
            expect.objectContaining({
              Source: 'kms.cache',
              DetailType: 'kms.redis.cache.rebuild.requested'
            })
          ])
        })
      )

      expect(logger.info).toHaveBeenCalledWith(
        '[cache-rebuild] Initiated asynchronous Redis cache rebuild'
      )
    })
  })

  describe('when unsuccessful', () => {
    test('should return a 500 response if EventBridge throws', async () => {
      sendEventBridgeMock.mockRejectedValue(new Error('EventBridge error'))

      const response = await requestRebuildRedisCache(event, context)

      expect(response).toEqual({
        statusCode: 500,
        headers: defaultResponseHeaders,
        body: JSON.stringify({
          message: 'Error initiating Redis cache rebuild',
          error: 'EventBridge error'
        })
      })

      expect(logger.error).toHaveBeenCalledWith(
        'Error initiating Redis cache rebuild:',
        expect.any(Error)
      )
    })

    test('should return a 500 response if EventBridge reports failed entries', async () => {
      sendEventBridgeMock.mockResolvedValue({ FailedEntryCount: 1 })

      const response = await requestRebuildRedisCache(event, context)

      expect(response).toEqual({
        statusCode: 500,
        headers: defaultResponseHeaders,
        body: JSON.stringify({
          message: 'Error initiating Redis cache rebuild',
          error: 'Failed to emit cache rebuild event. failedEntryCount=1'
        })
      })

      expect(logger.error).toHaveBeenCalledWith(
        'Error initiating Redis cache rebuild:',
        expect.any(Error)
      )
    })
  })
})

describe('when rebuildRedisCache is invoked by the worker', () => {
  const defaultResponseHeaders = { 'Access-Control-Allow-Origin': '*' }
  const event = {}
  const context = {}

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RDF_BUCKET_NAME = 'kms-rdf-backup-sit'

    vi.mocked(getApplicationConfig).mockReturnValue({
      defaultResponseHeaders
    })
  })

  describe('when RDF_BUCKET_NAME is missing', () => {
    test('should return a 500 response', async () => {
      delete process.env.RDF_BUCKET_NAME

      const response = await rebuildRedisCache(event, context)

      expect(response).toEqual({
        statusCode: 500,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'RDF_BUCKET_NAME is required to rebuild the historical cache'
        })
      })
    })
  })

  describe('when Redis is not configured', () => {
    test('should return a 503 response', async () => {
      vi.mocked(getRedisClient).mockResolvedValue(null)

      const response = await rebuildRedisCache(event, context)

      expect(response).toEqual({
        statusCode: 503,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Redis is not configured; cache rebuild cannot run'
        })
      })
    })
  })

  describe('when the flush and rebuild succeeds', () => {
    test('should flush Redis and rebuild every cache layer', async () => {
      const flushAll = vi.fn().mockResolvedValue('OK')
      const publishedCacheResult = {
        versionName: 'v1.0.0',
        schemeCount: 14,
        uploadedCount: 14,
        cachedCount: 42,
        cacheReady: true
      }
      const historicalCacheResult = {
        cacheReady: true,
        totalVersionCount: 3,
        pendingVersionCount: 3,
        processedFileCount: 42,
        markedVersionCount: 3
      }
      const responseCacheResult = {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Cache primed'
        })
      }

      vi.mocked(getRedisClient).mockResolvedValue({
        flushAll
      })

      vi.mocked(exportPublishSchemeCsvToS3).mockResolvedValue(publishedCacheResult)
      vi.mocked(buildHistoricalConceptCache).mockResolvedValue(historicalCacheResult)
      vi.mocked(primeConceptsCache).mockResolvedValue(responseCacheResult)

      const response = await rebuildRedisCache(event, context)

      expect(flushAll).toHaveBeenCalledTimes(1)
      expect(exportPublishSchemeCsvToS3).toHaveBeenCalledTimes(1)
      expect(buildHistoricalConceptCache).toHaveBeenCalledWith('kms-rdf-backup-sit')
      expect(primeConceptsCache).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith('[cache-rebuild] Completed Redis cache rebuild')
      expect(response).toEqual({
        statusCode: 200,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Redis cache flushed and rebuilt successfully',
          publishedCacheResult,
          historicalCacheResult,
          responseCacheResult: {
            message: 'Cache primed'
          }
        })
      })
    })
  })

  describe('when the rebuild fails', () => {
    test('should return a 500 response', async () => {
      const error = new Error('flush failed')

      vi.mocked(getRedisClient).mockResolvedValue({
        flushAll: vi.fn().mockRejectedValue(error)
      })

      const response = await rebuildRedisCache(event, context)

      expect(logger.error).toHaveBeenCalledWith(
        '[cache-rebuild] Failed to rebuild Redis cache: Error: flush failed'
      )

      expect(response).toEqual({
        statusCode: 500,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Error: flush failed'
        })
      })
    })
  })
})
