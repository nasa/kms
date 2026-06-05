import nodePath from 'path'

import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { getApplicationConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'

import {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName
} from '../redisCacheKeys'
import { getRedisClient } from '../redisCacheStore'

import { buildCacheEntries } from './helpers/buildCacheEntries'
import {
  HISTORICAL_CACHE_BUILT_VERSIONS_KEY,
  HISTORICAL_CACHE_FULL_PATH_SCHEME_SET,
  HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET
} from './helpers/constants'
import { createShortNameConceptResponseBody } from './helpers/createShortNameConceptResponseBody'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { parseFullPathCsvRecords } from './helpers/parseFullPathCsvRecords'
import { parseShortNameCsvRecords } from './helpers/parseShortNameCsvRecords'
import { writeCacheEntries } from './helpers/writeCacheEntries'

const writeHistoricalConceptCacheFromCsv = async ({
  csvContent,
  scheme,
  redisClient
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const cacheEntries = HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)
    ? buildCacheEntries({
      records: parseFullPathCsvRecords(csvContent),
      createCacheKey: (fullPath) => createConceptResponseCacheKeyByFullPath({
        fullPath: fullPath.toLowerCase(),
        scheme: normalizedScheme
      }),
      createResponseBody: (fullPath, uuid) => ({
        uuid,
        fullPath
      })
    })
    : buildCacheEntries({
      records: parseShortNameCsvRecords({
        csvContent,
        scheme: normalizedScheme
      }),
      createCacheKey: (shortName) => createConceptResponseCacheKeyByShortName({
        shortName: shortName.toLowerCase(),
        scheme: normalizedScheme
      }),
      createResponseBody: (shortName, value) => createShortNameConceptResponseBody(value)
    })

  const cachedCount = await writeCacheEntries({
    cacheEntries,
    redisClient
  })

  return {
    cachedCount
  }
}

const resolveHistoricalCacheBucketName = () => {
  if (process.env.RDF_BUCKET_NAME) {
    return process.env.RDF_BUCKET_NAME
  }

  const { env } = getApplicationConfig()

  if (env) {
    return `kms-rdf-backup-${env}`
  }

  throw new Error('RDF bucket name is required to rebuild the historical cache')
}

const normalizeVersionDirectory = (prefix) => String(prefix || '').replace(/\/+$/, '')

const supportsHistoricalCacheScheme = (scheme) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  return (
    HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)
    || HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET.has(normalizedScheme)
  )
}

const listVersionDirectories = async ({
  bucketName,
  s3Client
}) => {
  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucketName,
    Delimiter: '/'
  }))
  const prefixes = (response.CommonPrefixes || []).map((prefix) => prefix.Prefix)
  logger.info(`Found ${prefixes.length} version directories in bucket [${bucketName}].`)

  return prefixes
}

const listCsvFilesInDirectory = async ({
  bucketName,
  prefix,
  s3Client
}) => {
  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix
  }))

  const csvFiles = (response.Contents || [])
    .map((obj) => obj.Key)
    .filter((key) => key.toLowerCase().endsWith('.csv'))
    .filter((key) => supportsHistoricalCacheScheme(nodePath.basename(key, '.csv')))

  logger.debug(`Found ${csvFiles.length} valid CSV files in [${prefix}].`)

  return csvFiles
}

const getBuiltHistoricalVersions = async ({
  redisClient
}) => {
  try {
    const versions = await redisClient.sMembers(HISTORICAL_CACHE_BUILT_VERSIONS_KEY)

    return new Set(versions)
  } catch (error) {
    logger.warn(
      `[cache-builder] Failed reading historical cache version markers key=${HISTORICAL_CACHE_BUILT_VERSIONS_KEY} `
      + `error=${error.message}`
    )

    return new Set()
  }
}

const markHistoricalVersionBuilt = async ({
  redisClient,
  version
}) => {
  if (!version) {
    return
  }

  try {
    await redisClient.sAdd(HISTORICAL_CACHE_BUILT_VERSIONS_KEY, version)
    logger.info(`[cache-builder] Marked historical cache version built version=${version}`)
  } catch (error) {
    logger.warn(
      `[cache-builder] Failed writing historical cache version marker version=${version} `
      + `key=${HISTORICAL_CACHE_BUILT_VERSIONS_KEY} error=${error.message}`
    )
  }
}

const processBatch = async ({
  items,
  processor,
  batchSize
}) => {
  const results = []

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.allSettled(batch.map(processor))

    results.push(...batchResults)

    logger.info(
      `[cache-builder] Batch progress ${Math.min(index + batchSize, items.length)}/${items.length}`
    )
  }

  return results
}

const streamToString = async (stream) => new Promise((resolve, reject) => {
  const chunks = []
  stream.on('data', (chunk) => chunks.push(chunk))
  stream.on('error', reject)
  stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
})

const getS3ObjectContent = async ({
  bucketName,
  key,
  s3Client
}) => {
  logger.debug(`Downloading content from [s3://${bucketName}/${key}].`)
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  }))

  return streamToString(response.Body)
}

const defaultContext = {
  redisClientProvider: getRedisClient,
  s3ClientProvider: getS3Client
}

/**
 * Rebuilds the Redis historical concept cache from CSV snapshots stored in the RDF backup bucket.
 *
 * The workflow discovers version directories, filters supported CSV files, writes cache entries,
 * and marks fully successful versions as built.
 *
 * @param {{ redisClientProvider?: Function, s3ClientProvider?: Function }} [context=defaultContext] - Injectable runtime context for Redis/S3 access.
 * @returns {Promise<{
 *   cacheReady: boolean,
 *   totalVersionCount: number,
 *   pendingVersionCount: number,
 *   processedFileCount: number,
 *   markedVersionCount: number
 * }>} Historical cache rebuild summary.
 * @throws {Error} When Redis is unavailable, the bucket cannot be resolved, or required version
 * directory/file listing fails.
 *
 * @example
 * // Request
 * const result = await rebuildHistoricalConceptCache()
 *
 * // Response
 * // {
 * //   cacheReady: true,
 * //   totalVersionCount: 2,
 * //   pendingVersionCount: 2,
 * //   processedFileCount: 2,
 * //   markedVersionCount: 2
 * // }
 */
export const rebuildHistoricalConceptCache = async (context = defaultContext) => {
  const bucketName = resolveHistoricalCacheBucketName()

  const s3Client = context.s3ClientProvider()
  const redisClient = await context.redisClientProvider()

  if (!redisClient) {
    throw new Error('Redis is required to build the historical concept cache.')
  }

  logger.info(`Starting cache build from S3 bucket [${bucketName}].`)

  const phaseTimes = {}

  let phaseStartTime = Date.now()
  const versionDirs = await listVersionDirectories({
    bucketName,
    s3Client
  })
  phaseTimes.listDirectories = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  if (versionDirs.length === 0) {
    logger.warn('No version directories found in the bucket. Nothing to process.')

    return {
      cacheReady: true,
      totalVersionCount: 0,
      pendingVersionCount: 0,
      processedFileCount: 0,
      markedVersionCount: 0
    }
  }

  const builtVersions = await getBuiltHistoricalVersions({
    redisClient
  })
  const pendingVersionDirs = versionDirs.filter(
    (prefix) => !builtVersions.has(normalizeVersionDirectory(prefix))
  )

  logger.info(
    `[cache-builder] Historical version marker status total=${versionDirs.length} `
    + `built=${builtVersions.size} pending=${pendingVersionDirs.length}`
  )

  if (pendingVersionDirs.length === 0) {
    logger.info('All historical keyword versions are already cached in Redis. Nothing to process.')

    return {
      cacheReady: true,
      totalVersionCount: versionDirs.length,
      pendingVersionCount: 0,
      processedFileCount: 0,
      markedVersionCount: 0
    }
  }

  phaseStartTime = Date.now()
  const listResults = await processBatch({
    items: pendingVersionDirs,
    batchSize: 5,
    processor: async (prefix) => ({
      prefix,
      version: normalizeVersionDirectory(prefix),
      csvFiles: await listCsvFilesInDirectory({
        bucketName,
        prefix,
        s3Client
      })
    })
  })
  phaseTimes.listFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  const versionCsvGroups = []
  const listFailures = []

  listResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      versionCsvGroups.push(result.value)

      return
    }

    listFailures.push({
      prefix: pendingVersionDirs[index],
      message: result.reason?.message || 'Unknown error'
    })

    logger.error(
      `Failed listing CSV files for version directory [${pendingVersionDirs[index]}]: ${result.reason?.message}`
    )
  })

  const allCsvFiles = versionCsvGroups.flatMap(({ version, csvFiles }) => (
    csvFiles.map((key) => ({
      key,
      version
    }))
  ))

  if (allCsvFiles.length === 0) {
    if (listFailures.length > 0) {
      const errorMessages = listFailures
        .map(({ prefix, message }) => `Directory ${prefix}: ${message}`)
        .join('; ')

      throw new Error(
        `Failed to list CSV files in ${listFailures.length} version directories. `
        + `Historical cache must include all versions. Errors: ${errorMessages}`
      )
    }

    logger.warn('No CSV files found in any version directory. Nothing to process.')

    return {
      cacheReady: true,
      totalVersionCount: versionDirs.length,
      pendingVersionCount: pendingVersionDirs.length,
      processedFileCount: 0,
      markedVersionCount: 0
    }
  }

  logger.info(`Found a total of ${allCsvFiles.length} valid CSV files to process.`)

  phaseStartTime = Date.now()
  logger.info('Processing files in parallel batches of 5.')
  const processingResults = await processBatch({
    items: allCsvFiles,
    batchSize: 5,
    processor: async ({ key }) => {
      const scheme = nodePath.basename(key, '.csv').toLowerCase()
      const csvContent = await getS3ObjectContent({
        bucketName,
        key,
        s3Client
      })
      const { cachedCount } = await writeHistoricalConceptCacheFromCsv({
        csvContent,
        scheme,
        redisClient
      })

      logger.info(
        `Successfully processed [${key}] through redisPathStore entries=${cachedCount}.`
      )
    }
  })
  phaseTimes.processFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  const processingFailures = []
  processingResults.forEach((result, index) => {
    if (result.status !== 'rejected') {
      return
    }

    const failedFile = allCsvFiles[index]
    processingFailures.push({
      ...failedFile,
      message: result.reason?.message || 'Unknown error'
    })

    logger.error(`Failed to process file [${failedFile.key}]: ${result.reason?.message}`)
  })

  const failuresByVersion = processingFailures.reduce((accumulator, failure) => {
    const currentFailures = accumulator.get(failure.version) || 0
    accumulator.set(failure.version, currentFailures + 1)

    return accumulator
  }, new Map())

  let markedVersionCount = 0
  await Promise.all(versionCsvGroups.map(async ({ version, csvFiles }) => {
    if (csvFiles.length === 0) {
      logger.info(
        `[cache-builder] Skipping historical cache version marker version=${version} reason=no-valid-csv-files`
      )

      return
    }

    const failureCount = failuresByVersion.get(version) || 0
    if (failureCount > 0) {
      logger.warn(
        `[cache-builder] Not marking historical cache version built version=${version} `
        + `failedFiles=${failureCount}`
      )

      return
    }

    await markHistoricalVersionBuilt({
      redisClient,
      version
    })

    markedVersionCount += 1
  }))

  if (listFailures.length > 0) {
    const errorMessages = listFailures
      .map(({ prefix, message }) => `Directory ${prefix}: ${message}`)
      .join('; ')

    throw new Error(
      `Failed to list CSV files in ${listFailures.length} version directories. `
      + `Historical cache must include all versions. Errors: ${errorMessages}`
    )
  }

  if (processingFailures.length > 0) {
    const errorDetails = processingFailures
      .map(({ key, message }) => `${key}: ${message}`)
      .join('; ')

    throw new Error(
      `Failed to process ${processingFailures.length} of ${allCsvFiles.length} CSV files. `
      + `Historical cache must include all archived versions. Failed files: ${errorDetails}`
    )
  }

  logger.info(
    `Cache build process completed successfully for bucket [${bucketName}]. `
    + `Processed ${allCsvFiles.length} files. `
    + `Timing: ListDirs=${phaseTimes.listDirectories}s `
    + `ListFiles=${phaseTimes.listFiles}s `
    + `ProcessFiles=${phaseTimes.processFiles}s`
  )

  return {
    cacheReady: true,
    totalVersionCount: versionDirs.length,
    pendingVersionCount: pendingVersionDirs.length,
    processedFileCount: allCsvFiles.length,
    markedVersionCount
  }
}
