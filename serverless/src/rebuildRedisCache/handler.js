import { PutEventsCommand } from '@aws-sdk/client-eventbridge'

import { primeConceptsCache } from '@/primeConceptsCache/handler'
import { getEventBridgeClient } from '@/shared/awsClients'
import { buildHistoricalConceptCache } from '@/shared/buildHistoricalConceptCache'
import { exportPublishSchemeCsvToS3 } from '@/shared/exportPublishSchemeCsvToS3'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { getRedisClient } from '@/shared/redisCacheStore'

const REBUILD_CACHE_EVENT_SOURCE = 'kms.cache'
const REBUILD_CACHE_EVENT_DETAIL_TYPE = 'kms.redis.cache.rebuild.requested'

const rebuildCacheEventClient = getEventBridgeClient()

/**
 * Emits a cache-rebuild request event to EventBridge.
 *
 * @returns {Promise<void>}
 */
const emitRebuildCacheEvent = async () => {
  const eventBusName = process.env.PRIME_CACHE_EVENT_BUS_NAME || 'default'

  const response = await rebuildCacheEventClient.send(new PutEventsCommand({
    Entries: [
      {
        EventBusName: eventBusName,
        Source: REBUILD_CACHE_EVENT_SOURCE,
        DetailType: REBUILD_CACHE_EVENT_DETAIL_TYPE,
        Detail: JSON.stringify({
          requestedAt: new Date().toISOString()
        })
      }
    ]
  }))

  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    throw new Error(`Failed to emit cache rebuild event. failedEntryCount=${response.FailedEntryCount}`)
  }
}

/**
 * Initiates an asynchronous Redis cache rebuild.
 *
 * This API-facing handler emits an EventBridge event and returns immediately so API Gateway does
 * not need to wait for the full rebuild duration.
 *
 * @param {object} event - API Gateway event.
 * @param {object} context - Lambda context.
 * @returns {Promise<object>} API Gateway response object.
 */
export const requestRebuildRedisCache = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  try {
    await emitRebuildCacheEvent()

    logger.info('[cache-rebuild] Initiated asynchronous Redis cache rebuild')

    return {
      statusCode: 202,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Redis cache rebuild initiated'
      })
    }
  } catch (error) {
    logger.error('Error initiating Redis cache rebuild:', error)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Error initiating Redis cache rebuild',
        error: error.message
      })
    }
  }
}

/**
 * Flushes Redis and rebuilds all KMS cache layers.
 *
 * This EventBridge worker is an operational recovery tool. It clears the entire configured Redis
 * database with `FLUSHALL`, then rebuilds the caches that KMS normally prepares around publish
 * time:
 * - published concept lookup cache
 * - historical concept lookup cache
 * - published API/tree response cache
 *
 * It intentionally does not publish a new version or mutate RDF data. It only rebuilds Redis
 * state from the current published graph and archived CSV snapshots.
 *
 * @returns {Promise<object>} API Gateway response object.
 */
export const rebuildRedisCache = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const bucketName = process.env.RDF_BUCKET_NAME

  if (!bucketName) {
    return {
      statusCode: 500,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'RDF_BUCKET_NAME is required to rebuild the historical cache'
      })
    }
  }

  try {
    const redisClient = await getRedisClient()

    if (!redisClient) {
      return {
        statusCode: 503,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Redis is not configured; cache rebuild cannot run'
        })
      }
    }

    logger.info('[cache-rebuild] Flushing Redis before rebuild')
    await redisClient.flushAll()

    // Observed in SIT on 2026-05-31, a full flush-and-rebuild run completed in about
    // 5 minutes. That is comfortably inside the 15-minute Lambda timeout for now, but
    // if rebuild time grows materially we should split this into multiple async stages
    // instead of keeping all cache rebuild work in one worker invocation.
    logger.info('[cache-rebuild] Rebuilding published concept lookup cache and CSV snapshots')
    const publishedCacheResult = await exportPublishSchemeCsvToS3()

    logger.info('[cache-rebuild] Rebuilding historical concept cache from archived CSV snapshots')
    const historicalCacheResult = await buildHistoricalConceptCache(bucketName)

    logger.info('[cache-rebuild] Priming published API and tree response caches')
    const responseCacheResult = await primeConceptsCache()

    logger.info('[cache-rebuild] Completed Redis cache rebuild')

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Redis cache flushed and rebuilt successfully',
        publishedCacheResult,
        historicalCacheResult,
        responseCacheResult: JSON.parse(responseCacheResult.body)
      })
    }
  } catch (error) {
    logger.error(`[cache-rebuild] Failed to rebuild Redis cache: ${error.toString()}`)

    return {
      statusCode: 500,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default rebuildRedisCache
