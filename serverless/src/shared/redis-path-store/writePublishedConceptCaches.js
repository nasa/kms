import { PutObjectCommand } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'

import {
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} from '../redisCacheKeys'
import { clearCachedByPrefix, getRedisClient } from '../redisCacheStore'

import { buildCacheEntries } from './helpers/buildCacheEntries'
import {
  PUBLISHED_CACHE_FULL_PATH_SCHEME_SET,
  PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET
} from './helpers/constants'
import { createShortNameConceptResponseBody } from './helpers/createShortNameConceptResponseBody'
import { delay } from './helpers/delay'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { parseFullPathCsvRecords } from './helpers/parseFullPathCsvRecords'
import { parseShortNameCsvRecords } from './helpers/parseShortNameCsvRecords'
import { writeCacheEntries } from './helpers/writeCacheEntries'

const defaultContext = {
  redisClientProvider: getRedisClient,
  s3ClientProvider: getS3Client
}

const resolvePublishedExportBucketName = () => {
  const { env } = getApplicationConfig()

  if (env) {
    return `kms-rdf-backup-${env}`
  }

  throw new Error('Application environment is required to export published CSV snapshots')
}

const writePublishedConceptCacheFromCsv = async (
  context,
  {
    csvContent,
    scheme
  }
) => {
  const normalizeCacheNamespaceScheme = (cacheScheme) => (
    normalizeKeywordScheme(cacheScheme) === 'granuledataformat'
      ? 'dataformat'
      : normalizeKeywordScheme(cacheScheme)
  )

  const buildPublishedCacheEntriesFromCsv = ({
    csvContent: publishedCsvContent,
    scheme: publishedScheme
  }) => {
    const normalizedScheme = normalizeKeywordScheme(publishedScheme)
    const cacheNamespaceScheme = normalizeCacheNamespaceScheme(normalizedScheme)

    if (PUBLISHED_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)) {
      return {
        cacheEntries: buildCacheEntries({
          records: parseFullPathCsvRecords(publishedCsvContent),
          createCacheKey: (fullPath) => createPublishedConceptResponseCacheKeyByFullPath({
            fullPath: fullPath.toLowerCase(),
            scheme: normalizedScheme
          }),
          createResponseBody: (fullPath, uuid) => ({
            uuid,
            fullPath
          }),
          createUuidCacheKey: (uuid) => createPublishedConceptResponseCacheKeyByUuid({
            uuid,
            scheme: normalizedScheme
          })
        }),
        skipped: false,
        skipReason: null,
        cacheNamespaceScheme
      }
    }

    if (PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET.has(normalizedScheme)) {
      return {
        cacheEntries: buildCacheEntries({
          records: parseShortNameCsvRecords({
            csvContent: publishedCsvContent,
            scheme: normalizedScheme
          }),
          createCacheKey: (shortName) => createPublishedConceptResponseCacheKeyByShortName({
            shortName: shortName.toLowerCase(),
            scheme: normalizedScheme
          }),
          createResponseBody: (shortName, value) => createShortNameConceptResponseBody(value),
          createUuidCacheKey: (uuid) => createPublishedConceptResponseCacheKeyByUuid({
            uuid,
            scheme: normalizedScheme
          })
        }),
        skipped: false,
        skipReason: null,
        cacheNamespaceScheme
      }
    }

    return {
      cacheEntries: [],
      skipped: true,
      skipReason: 'unsupported_scheme',
      cacheNamespaceScheme
    }
  }

  const {
    cacheEntries,
    skipped,
    skipReason,
    cacheNamespaceScheme
  } = buildPublishedCacheEntriesFromCsv({
    csvContent,
    scheme
  })

  if (skipped) {
    return {
      cachedCount: 0,
      skipped: true,
      skipReason,
      cacheReady: true,
      cacheNamespaceScheme
    }
  }

  const redisClient = await context.redisClientProvider()

  if (!redisClient) {
    logger.warn(`[publisher] Skipping published concept cache prime scheme=${scheme} reason=redis_unavailable`)

    return {
      cachedCount: 0,
      skipped: true,
      skipReason: 'redis_unavailable',
      cacheReady: false,
      cacheNamespaceScheme
    }
  }

  await clearCachedByPrefix({
    keyPrefix: `kms:${cacheNamespaceScheme}:published_concept`
  })

  const cachedCount = await writeCacheEntries({
    cacheEntries,
    redisClient
  })

  logger.info(
    `[publisher] Primed published concept cache scheme=${scheme} entries=${cachedCount}`
  )

  return {
    cachedCount,
    skipped: false,
    skipReason: null,
    cacheReady: true,
    cacheNamespaceScheme
  }
}

const writePublishedConceptCachesToRedis = async (
  context,
  {
    schemes
  }
) => {
  // eslint-disable-next-line import/no-cycle
  const { downloadConcepts } = await import('@/shared/downloadConcepts')
  const schemeResults = []
  const failedSchemes = []
  let cachedCount = 0

  await schemes.reduce(
    (previousPromise, schemeEntry) => previousPromise.then(async () => {
      const notation = typeof schemeEntry === 'string'
        ? schemeEntry
        : schemeEntry?.notation

      if (!notation) {
        return
      }

      try {
        const csvContent = await downloadConcepts({
          conceptScheme: notation,
          format: 'csv',
          version: 'published',
          bypassCache: true
        })

        const cacheResult = await writePublishedConceptCacheFromCsv(context, {
          csvContent,
          scheme: notation
        })

        cachedCount += cacheResult.cachedCount
        schemeResults.push({
          notation,
          csvContent,
          ...cacheResult
        })
      } catch (error) {
        logger.error(
          `[publisher] Failed to prime published cache for scheme ${notation}: ${error.message}`
        )

        failedSchemes.push({
          notation,
          error: error.message
        })
      }
    }),
    Promise.resolve()
  )

  const allSchemesCacheReady = schemeResults.every((result) => result.cacheReady)

  return {
    schemeResults,
    failedSchemes,
    cachedCount,
    cacheReady: failedSchemes.length === 0 && allSchemesCacheReady
  }
}

/**
 * Primes the published concept caches in Redis and exports the same published CSV snapshots to S3.
 *
 * This workflow is the published-side companion to the historical cache rebuild path.
 *
 * @param {{ redisClientProvider?: Function, s3ClientProvider?: Function }} [context=defaultContext] - Injectable runtime context for Redis/S3 access.
 * @returns {Promise<{
 *   versionName: string,
 *   schemeCount: number,
 *   uploadedCount: number,
 *   cachedCount: number,
 *   cacheReady: boolean,
 *   schemeResults: Array<object>,
 *   failedSchemes: Array<{ notation: string, error: string }>
 * }>} Published cache/export summary.
 * @throws {Error} When the export bucket or published version name cannot be resolved, or any
 * scheme cache/export step fails.
 *
 * @example
 * // Request
 * const result = await writePublishedConceptCaches()
 *
 * // Response
 * // {
 * //   versionName: '23.3',
 * //   schemeCount: 43,
 * //   uploadedCount: 43,
 * //   cachedCount: 183,
 * //   cacheReady: true,
 * //   schemeResults: [
 * //     {
 * //       notation: 'sciencekeywords',
 * //       cachedCount: 2,
 * //       skipped: false,
 * //       skipReason: null,
 * //       cacheReady: true,
 * //       cacheNamespaceScheme: 'sciencekeywords'
 * //     }
 * //   ],
 * //   failedSchemes: []
 * // }
 */
export const writePublishedConceptCaches = async (context = defaultContext) => {
  const s3ExportDelayMs = parseInt(process.env.S3_EXPORT_DELAY_MS || '100', 10)
  const bucketName = resolvePublishedExportBucketName()
  const s3Client = context.s3ClientProvider()
  const { versionName } = await getVersionMetadata('published')

  if (!versionName) {
    throw new Error('Could not determine published version name.')
  }

  const normalizedSchemes = await getConceptSchemeDetails({
    version: 'published'
  })
  const schemes = Array.isArray(normalizedSchemes) ? normalizedSchemes : []

  if (!schemes || schemes.length === 0) {
    logger.warn('No published concept schemes found to export.')

    return {
      versionName,
      schemeCount: 0,
      uploadedCount: 0,
      cachedCount: 0,
      cacheReady: true,
      schemeResults: [],
      failedSchemes: []
    }
  }

  logger.info(
    `[publisher] Starting published CSV export version=${versionName} bucket=${bucketName} schemes=${schemes.length}`
  )

  const {
    schemeResults,
    failedSchemes,
    cachedCount,
    cacheReady: publishedCacheReady
  } = await writePublishedConceptCachesToRedis(context, {
    schemes
  })

  const uploadFailures = []
  let uploadedCount = 0

  await schemeResults.reduce(
    (previousPromise, schemeResult, index) => previousPromise.then(async () => {
      const {
        notation,
        csvContent,
        cacheReady,
        skipReason
      } = schemeResult

      if (!cacheReady) {
        const errorMessage = [
          `Published concept cache not ready for scheme=${notation}`,
          `reason=${skipReason}`
        ].join(' ')

        logger.error(`Failed to process scheme ${notation}: ${errorMessage}`)
        uploadFailures.push({
          notation,
          error: errorMessage
        })

        return
      }

      try {
        const s3Key = `${versionName}/${notation}.csv`

        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: csvContent,
          ContentType: 'text/csv'
        }))

        uploadedCount += 1

        if (s3ExportDelayMs > 0 && index < schemeResults.length - 1) {
          await delay(s3ExportDelayMs)
        }
      } catch (error) {
        logger.error(`Failed to process scheme ${notation}: ${error.message}`)
        uploadFailures.push({
          notation,
          error: error.message
        })
      }
    }),
    Promise.resolve()
  )

  const allFailures = [...failedSchemes, ...uploadFailures]

  if (allFailures.length > 0) {
    throw new Error(`Failed to export CSV for schemes: ${allFailures.map(({ notation }) => notation).join(', ')}`)
  }

  logger.info(
    `[publisher] Completed published CSV export version=${versionName} bucket=${bucketName} schemes=${schemes.length} uploaded=${uploadedCount} cached=${cachedCount} failed=${failedSchemes.length}`
  )

  return {
    versionName,
    schemeCount: schemes.length,
    uploadedCount,
    cachedCount,
    cacheReady: publishedCacheReady,
    schemeResults,
    failedSchemes
  }
}
