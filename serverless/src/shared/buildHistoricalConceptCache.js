import path from 'path'

import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

import { getS3Client } from './awsClients'
import { ConceptForFullPathCacheBuilder } from './conceptForFullPathCacheBuilder'
import { ConceptForShortNameCacheBuilder } from './conceptForShortNameCacheBuilder'
import {
  DEFAULT_HISTORICAL_CONCEPT_FULL_PATH_SCHEMES
} from './constants/fullPathForHistoricalConceptSchemes'
import {
  DEFAULT_HISTORICAL_CONCEPT_SHORT_NAME_SCHEMES
} from './constants/shortNameForHistoricalConceptSchemes'
import { getApplicationConfig } from './getConfig'
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

  const {
    schemesForHistoricalConceptByFullPath: schemesForHistoricalConceptByFullPathFromConfig,
    schemesForHistoricalConceptByShortName: schemesForHistoricalConceptByShortNameFromConfig
  } = getApplicationConfig()

  const sourceForFullPath = schemesForHistoricalConceptByFullPathFromConfig?.length
    ? schemesForHistoricalConceptByFullPathFromConfig
    : DEFAULT_HISTORICAL_CONCEPT_FULL_PATH_SCHEMES
  const fullPathSchemes = sourceForFullPath.map((s) => s.toLowerCase())

  const sourceForShortName = schemesForHistoricalConceptByShortNameFromConfig?.length
    ? schemesForHistoricalConceptByShortNameFromConfig
    : DEFAULT_HISTORICAL_CONCEPT_SHORT_NAME_SCHEMES
  const shortNameSchemes = sourceForShortName.map((s) => s.toLowerCase())

  const fullPathCacheBuilder = new ConceptForFullPathCacheBuilder()
  const shortNameCacheBuilder = new ConceptForShortNameCacheBuilder()

  /**
   * Lists the top-level directories in the S3 bucket, which correspond to keyword versions.
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
   * Lists all `.csv` files within a given directory prefix in the S3 bucket.
   * @param {string} prefix - The directory prefix to scan for CSV files.
   * @returns {Promise<string[]>} A promise that resolves to an array of S3 keys for the CSV files.
   */
  const listCsvFilesInDirectory = async (prefix) => {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix
    })
    const response = await s3Client.send(command)
    const csvFiles = (response.Contents || [])
      .map((obj) => obj.Key)
      .filter((key) => key.toLowerCase().endsWith('.csv'))
    logger.debug(`Found ${csvFiles.length} CSV files in [${prefix}].`)

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

  const versionDirs = await listVersionDirectories()
  if (versionDirs.length === 0) {
    logger.warn('No version directories found in the bucket. Nothing to process.')

    return
  }

  // Sequentially list files in each directory to avoid excessive ListObjects calls
  const allCsvFiles = await versionDirs.reduce(async (accPromise, prefix) => {
    const acc = await accPromise
    const filesInDir = await listCsvFilesInDirectory(prefix)

    return acc.concat(filesInDir)
  }, Promise.resolve([]))

  if (allCsvFiles.length === 0) {
    logger.warn('No CSV files found in any version directory. Nothing to process.')

    return
  }

  logger.info(`Found a total of ${allCsvFiles.length} CSV files to process.`)

  // Process files in batches to avoid overwhelming S3 with too many concurrent requests.
  // The concurrency level can be adjusted via environment variables.
  const concurrency = parseInt(process.env.HISTORICAL_CONCEPT_CACHE_CONCURRENCY, 10) || 10
  logger.info(`Processing files with a concurrency of ${concurrency}.`)

  // Create chunks of files to process using array-based methods
  const chunks = Array.from(
    { length: Math.ceil(allCsvFiles.length / concurrency) },
    (_, i) => allCsvFiles.slice(i * concurrency, i * concurrency + concurrency)
  )

  // Process chunks sequentially to respect batching
  await chunks.reduce(async (prevPromise, chunk) => {
    await prevPromise // Wait for the previous batch to complete
    logger.debug(`Processing a chunk of ${chunk.length} files.`)

    const processingJobs = chunk.map(async (key) => {
      try {
        const scheme = path.basename(key, '.csv').toLowerCase()
        const csvContent = await getObjectContent(key)

        if (fullPathSchemes.includes(scheme)) {
          await fullPathCacheBuilder.processToCache(csvContent, { scheme })
          logger.info(`Successfully processed [${key}] with ConceptForFullPathCacheBuilder.`)
        } else if (shortNameSchemes.includes(scheme)) {
          await shortNameCacheBuilder.processToCache(csvContent, { scheme })
          logger.info(`Successfully processed [${key}] with ConceptForShortNameCacheBuilder.`)
        } else {
          logger.warn(`No cache builder found for scheme [${scheme}] in file [${key}].`)
        }
      } catch (error) {
        logger.error(`Failed to process file [${key}]: ${error.message}`)
      }
    })

    await Promise.all(processingJobs)
  }, Promise.resolve())

  logger.info(`Cache build process finished for bucket [${bucketName}].`)
}
