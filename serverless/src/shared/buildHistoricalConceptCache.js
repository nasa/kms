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

  // Phase 2: List CSV files in all directories
  phaseStartTime = Date.now()
  const LIST_BATCH_SIZE = 5
  const listResults = await processBatch(
    versionDirs,
    async (prefix) => listCsvFilesInDirectory(prefix),
    LIST_BATCH_SIZE
  )

  // Fail fast if any directory listing failed - we need complete coverage
  const failures = listResults.filter((result) => result.status === 'rejected')
  if (failures.length > 0) {
    const errorMessages = failures.map((f, idx) => `Directory ${versionDirs[idx]}: ${f.reason?.message || 'Unknown error'}`).join('; ')
    throw new Error(
      `Failed to list CSV files in ${failures.length} version directories. `
      + `Historical cache must include all versions. Errors: ${errorMessages}`
    )
  }

  const allCsvFiles = listResults.flatMap((result) => result.value)
  phaseTimes.listFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  if (allCsvFiles.length === 0) {
    logger.warn('No CSV files found in any version directory. Nothing to process.')

    return
  }

  logger.info(`Found a total of ${allCsvFiles.length} valid CSV files to process.`)

  // Phase 3: Download, parse, and write to Redis
  phaseStartTime = Date.now()
  const PROCESS_BATCH_SIZE = 5
  logger.info(`Processing files in parallel batches of ${PROCESS_BATCH_SIZE}.`)

  const results = await processBatch(
    allCsvFiles,
    async (key) => {
      const scheme = path.basename(key, '.csv').toLowerCase()

      const csvContent = await getObjectContent(key)

      // All files have been pre-filtered, so we know they match a valid scheme
      if (fullPathSchemes.includes(scheme)) {
        await fullPathCacheBuilder.processToCache(csvContent, { scheme })
        logger.info(`Successfully processed [${key}] with ConceptForFullPathCacheBuilder.`)
      } else {
        // Must be a short name scheme since it was pre-filtered
        await shortNameCacheBuilder.processToCache(csvContent, { scheme })
        logger.info(`Successfully processed [${key}] with ConceptForShortNameCacheBuilder.`)
      }
    },
    PROCESS_BATCH_SIZE
  )
  phaseTimes.processFiles = ((Date.now() - phaseStartTime) / 1000).toFixed(2)

  // Fail if any files couldn't be processed - we need complete cache coverage
  const processingFailures = results.filter((result) => result.status === 'rejected')
  if (processingFailures.length > 0) {
    const errorDetails = processingFailures.map((f) => {
      const failedFileIndex = results.indexOf(f)
      const failedKey = allCsvFiles[failedFileIndex]

      return `${failedKey}: ${f.reason?.message || 'Unknown error'}`
    }).join('; ')

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
}
