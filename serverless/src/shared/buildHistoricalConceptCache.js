import path from 'path'

import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

import { getS3Client } from './awsClients'
import { ConceptForFullPathCacheBuilder } from './conceptForFullPathCacheBuilder'
import { ConceptForShortNameCacheBuilder } from './conceptForShortNameCacheBuilder'
import {
  HISTORICAL_CONCEPT_FULL_PATH_SCHEMES
} from './constants/fullPathForHistoricalConceptSchemes'
import {
  HISTORICAL_CONCEPT_SHORT_NAME_SCHEMES
} from './constants/shortNameForHistoricalConceptSchemes'
import { logger } from './logger'
import { getRedisClient } from './redisCacheStore'

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
 * @throws {Error} If the bucket name is not provided.
 */
export const buildHistoricalConceptCache = async (bucketName) => {
  if (!bucketName) {
    throw new Error('An S3 bucket name is required to build the cache.')
  }

  const s3Client = getS3Client()

  const fullPathSchemes = HISTORICAL_CONCEPT_FULL_PATH_SCHEMES.map((s) => s.toLowerCase())
  const shortNameSchemes = HISTORICAL_CONCEPT_SHORT_NAME_SCHEMES.map((s) => s.toLowerCase())

  const fullPathCacheBuilder = new ConceptForFullPathCacheBuilder()
  const shortNameCacheBuilder = new ConceptForShortNameCacheBuilder()
  const redisClient = await getRedisClient()

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

    return
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

    return
  }

  // Phase 2: List CSV files in all directories
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
  csvListResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      versionCsvGroups.push(result.value)

      return
    }

    // A directory listing failure means we cannot trust that version to be complete,
    // so we log it and leave the version out of the "built" marker set.
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
    logger.warn('No CSV files found in any version directory. Nothing to process.')

    return
  }

  logger.info(`Found a total of ${allCsvFiles.length} valid CSV files to process.`)

  // Phase 3: Download, parse, and write to Redis
  phaseStartTime = Date.now()
  const PROCESS_BATCH_SIZE = 5
  logger.info(`Processing files in parallel batches of ${PROCESS_BATCH_SIZE}.`)

  let successCount = 0
  let failCount = 0

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

      // The cache builders intentionally do batched mSet writes and report whether every
      // entry made it into Redis. A partial write should not let us mark the version as done.
      if (cacheWriteResult?.failedCount > 0) {
        throw new Error(
          `Redis cache write incomplete for [${key}] failedCount=${cacheWriteResult.failedCount}`
        )
      }
    },
    PROCESS_BATCH_SIZE
  )
  phaseTimes.processFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successCount += 1
    } else {
      failCount += 1
      logger.error(`Failed to process file [${allCsvFiles[index].key}]: ${result.reason?.message}`)
    }
  })

  // Redis markers are version-level, not file-level. If any CSV in a version fails,
  // that version stays pending and will be retried on the next historical cache build.
  const failuresByVersion = results.reduce((accumulator, result, index) => {
    if (result.status === 'fulfilled') return accumulator

    const { version } = allCsvFiles[index]
    const currentFailures = accumulator.get(version) || 0
    accumulator.set(version, currentFailures + 1)

    return accumulator
  }, new Map())

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
  }))

  logger.info(
    `Cache build process finished for bucket [${bucketName}]. `
    + `Success: ${successCount}, Failed: ${failCount}. `
    + `Timing: ListDirs=${phaseTimes.listDirectories}s `
    + `ListFiles=${phaseTimes.listFiles}s `
    + `ProcessFiles=${phaseTimes.processFiles}s`
  )
}
