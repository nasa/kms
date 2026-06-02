import path from 'path'

import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

import { getS3Client } from './awsClients'
import { ConceptForFullPathCacheBuilder } from './conceptForFullPathCacheBuilder'
import { ConceptForShortNameCacheBuilder } from './conceptForShortNameCacheBuilder'
import {
  HISTORICAL_CACHE_FULL_PATH_SCHEMES,
  HISTORICAL_CACHE_SHORT_NAME_SCHEMES
} from './keywordPaths'
import { logger } from './logger'
import { getRedisClient } from './redisCacheStore'

/**
 * Historical concept-cache rebuild orchestration for archived KMS keyword versions.
 *
 * This module walks the versioned CSV snapshots stored in S3 and writes Redis lookup entries that
 * let KMS resolve old keyword values back to their historical concept UUIDs and paths. Those
 * historical lookups are what power metadata-correction resolution when a collection still
 * contains an outdated keyword after KMS has published a newer version.
 *
 * The important optimization here is that S3 version directories are immutable. Once a version's
 * CSV files have been fully processed into Redis, we record that version in a small Redis set and
 * skip it on later rebuilds. That lets repeated publishes process only newly archived versions
 * instead of re-reading the entire historical bucket every time.
 */

// Historical keyword versions in S3 are immutable, so once a version's CSVs have been
// fully written to Redis we can remember that fact and skip it on future rebuilds.
const HISTORICAL_CACHE_BUILD_MARKER_VERSION = 'v1'
const HISTORICAL_CACHE_BUILT_VERSIONS_KEY = `kms:historical_concept:versions:built:${HISTORICAL_CACHE_BUILD_MARKER_VERSION}`

// S3 returns version directories with trailing slashes, but Redis markers are stored as bare version names.
const normalizeVersionDirectory = (prefix = '') => prefix.replace(/\/+$/, '')

/**
 * Helper function to convert a stream to a string.
 * @param {ReadableStream} stream - The stream to convert.
 * @returns {Promise<string>} The string representation of the stream.
 */
const streamToString = (stream) => new Promise((resolve, reject) => {
  const chunks = []
  stream.on('data', (chunk) => chunks.push(chunk))
  stream.on('error', reject)
  stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
})

/**
 * Process items in parallel batches with controlled concurrency.
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} batchSize - Number of concurrent operations
 * @returns {Promise<Array>} Results of processing
 */
const processBatch = async (items, processor, batchSize) => {
  const results = []

  // Process batches sequentially to control concurrency and avoid overwhelming S3/Redis
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.allSettled(batch.map(processor))

    results.push(...batchResults)

    logger.info(
      `[cache-builder] Batch progress ${Math.min(i + batchSize, items.length)}/${items.length}`
    )
  }

  return results
}

/**
 * Orchestrates building the Historical Concept cache from CSV files stored in an S3 bucket.
 * It scans a given S3 bucket for version directories, finds all `.csv` files
 * within them, and uses the appropriate cache builder to process each file's content.
 *
 * The function determines which builder to use based on the file's name, which
 * should correspond to a concept scheme. For example, a file named `sciencekeywords.csv`
 * will be processed by the `ConceptForFullPathCacheBuilder` if 'sciencekeywords' is
 * defined as a full-path scheme. Similarly, `instruments.csv` will be processed by
 * the `ConceptForShortNameCacheBuilder` if 'instruments' is a short-name scheme.
 *
 * @param {string} bucketName - The name of the S3 bucket to process.
 * @returns {Promise<{
 *   cacheReady: boolean,
 *   totalVersionCount: number,
 *   pendingVersionCount: number,
 *   processedFileCount: number,
 *   markedVersionCount: number
 * }>} Summary describing whether Redis-backed historical lookups are ready.
 * @throws {Error} If the bucket name is not provided.
 */
export const buildHistoricalConceptCache = async (bucketName) => {
  if (!bucketName) {
    throw new Error('An S3 bucket name is required to build the cache.')
  }

  const s3Client = getS3Client()

  const fullPathSchemes = HISTORICAL_CACHE_FULL_PATH_SCHEMES.map((s) => s.toLowerCase())
  const shortNameSchemes = HISTORICAL_CACHE_SHORT_NAME_SCHEMES.map((s) => s.toLowerCase())

  const fullPathCacheBuilder = new ConceptForFullPathCacheBuilder()
  const shortNameCacheBuilder = new ConceptForShortNameCacheBuilder()
  const redisClient = await getRedisClient()

  if (!redisClient) {
    throw new Error('Redis is required to build the historical concept cache.')
  }

  /**
   * Lists the top-level directories in the S3 bucket, which correspond to keyword versions.
   *
   * WARNING: This only reads the first page of results (max 1000 directories).
   * If we ever have more than 1000 version directories, we'll need to implement
   * pagination using the ContinuationToken.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array of version directory prefixes.
   */
  const listVersionDirectories = async () => {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Delimiter: '/'
    })
    const response = await s3Client.send(command)
    const prefixes = (response.CommonPrefixes || []).map((prefix) => prefix.Prefix)
    logger.info(`Found ${prefixes.length} version directories in bucket [${bucketName}].`)

    return prefixes
  }

  /**
   * Lists all `.csv` files for valid schemes within a given directory prefix in the S3 bucket.
   *
   * WARNING: This only reads the first page of results (max 1000 objects per directory).
   * If a single version directory ever contains more than 1000 CSV files, we'll need to
   * implement pagination using the ContinuationToken.
   *
   * @param {string} prefix - The directory prefix to scan for CSV files.
   * @returns {Promise<string[]>} A promise that resolves to an array of S3 keys for the CSV files matching valid schemes.
   */
  const listCsvFilesInDirectory = async (prefix) => {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix
    })
    const response = await s3Client.send(command)

    const allValidSchemes = [...fullPathSchemes, ...shortNameSchemes]
    const csvFiles = (response.Contents || [])
      .map((obj) => obj.Key)
      .filter((key) => {
        if (!key.toLowerCase().endsWith('.csv')) {
          return false
        }

        const scheme = path.basename(key, '.csv').toLowerCase()

        return allValidSchemes.includes(scheme)
      })

    logger.debug(`Found ${csvFiles.length} valid CSV files in [${prefix}].`)

    return csvFiles
  }

  /**
   * Downloads and returns the content of an S3 object as a string.
   * @param {string} key - The S3 key of the object to download.
   * @returns {Promise<string>} A promise that resolves to the UTF-8 content of the file.
   */
  const getObjectContent = async (key) => {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    })
    logger.debug(`Downloading content from [s3://${bucketName}/${key}].`)
    const response = await s3Client.send(command)

    return streamToString(response.Body)
  }

  /**
   * Reads the Redis set of immutable historical versions that were already cached successfully.
   * We keep this separate from the concept keys so we can skip reprocessing old versions on later publishes.
   *
   * If the marker key ever needs to be invalidated because the cache format or supported schemes changed,
   * bump HISTORICAL_CACHE_BUILD_MARKER_VERSION above and Redis will rebuild every version once.
   *
   * @returns {Promise<Set<string>>} Cached version names already written successfully.
   */
  const getBuiltHistoricalVersions = async () => {
    if (!redisClient) return new Set()

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

  /**
   * Marks one immutable keyword version as successfully cached so future historical builds can skip it.
   *
   * @param {string} version - Version directory name without a trailing slash.
   * @returns {Promise<void>}
   */
  const markHistoricalVersionBuilt = async (version) => {
    if (!redisClient || !version) return

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

  logger.info(`Starting cache build from S3 bucket [${bucketName}].`)

  const phaseTimes = {}

  // Phase 1: List version directories
  let phaseStartTime = Date.now()
  const versionDirs = await listVersionDirectories()
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

  const builtVersions = await getBuiltHistoricalVersions()
  // Skip historical versions that were already fully cached. This is the main
  // speedup: old published keyword snapshots never change, so there is no value
  // in re-downloading and re-writing them on every publish.
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

  // Phase 2: List CSV files in all pending directories
  phaseStartTime = Date.now()
  const LIST_BATCH_SIZE = 5
  const csvListResults = await processBatch(
    pendingVersionDirs,
    async (prefix) => ({
      prefix,
      version: normalizeVersionDirectory(prefix),
      csvFiles: await listCsvFilesInDirectory(prefix)
    }),
    LIST_BATCH_SIZE
  )
  phaseTimes.listFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  const versionCsvGroups = []
  const listFailures = []

  csvListResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      versionCsvGroups.push(result.value)

      return
    }

    // A directory listing failure means we cannot trust that version to be complete,
    // so we leave the version out of the "built" marker set and report the issue after
    // we finish marking any versions that did succeed.
    listFailures.push({
      prefix: pendingVersionDirs[index],
      message: result.reason?.message || 'Unknown error'
    })

    logger.error(
      `Failed listing CSV files for version directory [${pendingVersionDirs[index]}]: ${result.reason?.message}`
    )
  })

  // Keep track of which S3 object belongs to which immutable version so we can
  // decide later whether a whole version succeeded and is safe to mark as built.
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

  // Phase 3: Download, parse, and write to Redis
  phaseStartTime = Date.now()
  const PROCESS_BATCH_SIZE = 5
  logger.info(`Processing files in parallel batches of ${PROCESS_BATCH_SIZE}.`)

  const results = await processBatch(
    allCsvFiles,
    async ({ key }) => {
      const scheme = path.basename(key, '.csv').toLowerCase()
      const csvContent = await getObjectContent(key)
      let cacheWriteResult

      // All files have been pre-filtered, so we know they match a valid scheme
      if (fullPathSchemes.includes(scheme)) {
        cacheWriteResult = await fullPathCacheBuilder.processToCache(csvContent, { scheme })
        logger.info(`Successfully processed [${key}] with ConceptForFullPathCacheBuilder.`)
      } else {
        // Must be a short name scheme since it was pre-filtered
        cacheWriteResult = await shortNameCacheBuilder.processToCache(csvContent, { scheme })
        logger.info(`Successfully processed [${key}] with ConceptForShortNameCacheBuilder.`)
      }

      // The cache builders throw on incomplete Redis writes, but keep this defensive check
      // for mocked/tested builder responses that may report failures instead of throwing.
      if (cacheWriteResult?.failedCount > 0) {
        throw new Error(
          `Redis cache write incomplete for [${key}] failedCount=${cacheWriteResult.failedCount}`
        )
      }

      if (cacheWriteResult?.skipped) {
        throw new Error(`Redis cache write skipped for [${key}]`)
      }
    },
    PROCESS_BATCH_SIZE
  )
  phaseTimes.processFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  const processingFailures = []
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const failedFile = allCsvFiles[index]
      processingFailures.push({
        ...failedFile,
        message: result.reason?.message || 'Unknown error'
      })

      logger.error(`Failed to process file [${failedFile.key}]: ${result.reason?.message}`)
    }
  })

  // Redis markers are version-level, not file-level. If any CSV in a version fails,
  // that version stays pending and will be retried on the next historical cache build.
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

    // We only record a version as built after every recognized CSV in that immutable
    // version directory finished successfully. Future runs can now skip it entirely.
    await markHistoricalVersionBuilt(version)
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
