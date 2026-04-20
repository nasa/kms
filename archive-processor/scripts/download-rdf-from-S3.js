import { createWriteStream, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { fileURLToPath } from 'url'

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client
} from '@aws-sdk/client-s3'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)

/**
 * AWS Region for the S3 bucket
 * @type {string}
 */
const region = process.env.AWS_REGION || 'us-east-1'

/**
 * S3 bucket name to download files from
 * @type {string}
 */
const bucketName = process.env.S3_BUCKET_NAME || 'kms-rdf-backup-sit'

/**
 * AWS Profile to use (optional)
 * @type {string|undefined}
 */
const awsProfile = process.env.AWS_PROFILE

/**
 * Output directory for downloaded files
 * @type {string}
 */
const outputDir = join(scriptDir, '..', 'downloaded-rdf')

/**
 * Delay in milliseconds between downloads to avoid rate limiting
 * Default: 100ms (configurable via DOWNLOAD_DELAY_MS environment variable)
 * Set to 0 to disable delay
 * @type {number}
 */
const downloadDelayMs = parseInt(process.env.DOWNLOAD_DELAY_MS || '100', 10)

/**
 * Optional comma-separated list of specific versions to download.
 * If empty, the script will download all RDF files.
 * These should be the S3 key prefixes (e.g., "10.0", "KMS-654-Testing").
 * @type {string}
 */
const toBeDownloadedVersions = process.env.TO_BE_DOWNLOADED_VERSIONS || ''

/**
 * S3 Client configured for the specified region
 * @type {S3Client}
 */
const s3Client = new S3Client({
  region,
  ...(awsProfile && { credentials: undefined })
})

/**
 * Extracts the version name from an S3 object key
 * Examples:
 *   "10.0/rdf.xml" -> "10.0"
 *   "draft/2026/03/16/rdf.xml" -> "draft-2026-03-16"
 *   "KMS-654-Testing/rdf.xml" -> "KMS-654-Testing"
 *
 * @param {string} key - S3 object key
 * @returns {string} Version name suitable for use as a filename
 */
const extractVersionName = (key) => {
  // Remove the trailing "/rdf.xml"
  const versionPath = key.replace('/rdf.xml', '')

  // Replace slashes with hyphens for flat file structure
  return versionPath.replace(/\//g, '-')
}

/**
 * Delays execution for the specified number of milliseconds
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

/**
 * Downloads a single RDF file from S3
 *
 * @param {string} key - S3 object key
 * @param {number} index - Current file index (for progress display)
 * @param {number} total - Total number of files to download
 * @returns {Promise<{success: boolean, key: string, outputPath?: string, error?: Error}>}
 */
const downloadRdfFile = async (key, index, total) => {
  const versionName = extractVersionName(key)
  const fileName = `${versionName}.rdf.xml`
  const outputPath = join(outputDir, fileName)

  try {
    console.log(`[${index}/${total}] Downloading: ${key} -> ${fileName}`)

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    })

    const response = await s3Client.send(command)

    if (!response.Body) {
      throw new Error('No data returned from S3')
    }

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    // Stream the file to disk
    const writeStream = createWriteStream(outputPath)
    await pipeline(response.Body, writeStream)

    console.log(`[${index}/${total}] ✓ Downloaded: ${fileName}`)

    return {
      success: true,
      key,
      outputPath
    }
  } catch (error) {
    console.error(`[${index}/${total}] ✗ Failed to download ${key}:`, error.message)

    return {
      success: false,
      key,
      error
    }
  }
}

/**
 * Lists all RDF objects from S3 bucket, excluding drafts
 *
 * @returns {Promise<Array<string>>} Array of S3 object keys
 */
const listS3Objects = async () => {
  console.log(`Listing objects from bucket: ${bucketName}...`)

  const allObjectKeys = []
  let continuationToken
  let pageCount = 0

  /* eslint-disable no-await-in-loop */
  do {
    pageCount += 1
    console.log(`Fetching page ${pageCount}...`)

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken
    })

    const response = await s3Client.send(command)

    // Extract object keys from the current page, excluding drafts
    if (response.Contents) {
      const keys = response.Contents
        .map((obj) => obj.Key)
        .filter(Boolean)
        .filter((key) => !key.startsWith('draft/')) // Exclude draft objects
        .filter((key) => key.endsWith('/rdf.xml')) // Only include main RDF files
      allObjectKeys.push(...keys)
      console.log(`Found ${keys.length} objects in page ${pageCount} (draft objects excluded)`)
    }

    // Check if there are more pages to fetch
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  /* eslint-enable no-await-in-loop */

  console.log(`\nTotal objects found: ${allObjectKeys.length}\n`)

  return allObjectKeys
}

/**
 * Downloads all RDF files from S3
 *
 * @returns {Promise<void>}
 */
const downloadAllRdfFiles = async () => {
  // List all objects from S3
  let objects

  const versionList = toBeDownloadedVersions.split(',').map((v) => v.trim()).filter(Boolean)

  // If a non-empty list of versions is provided, construct the object keys
  if (versionList.length > 0) {
    console.log(`\nFound ${versionList.length} specific versions to download.`)
    objects = versionList.map((version) => `${version}/rdf.xml`)
  } else {
    // Otherwise, list all objects from S3
    objects = await listS3Objects()
  }

  const totalFiles = objects.length

  console.log(`Starting download of ${totalFiles} RDF files...`)
  console.log(`Output directory: ${outputDir}\n`)

  const results = []

  // Download files sequentially to avoid overwhelming the connection
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < objects.length; i += 1) {
    const key = objects[i]
    const result = await downloadRdfFile(key, i + 1, totalFiles)
    results.push(result)

    // Add delay between downloads if configured
    if (downloadDelayMs > 0 && i < objects.length - 1) {
      await delay(downloadDelayMs)
    }
  }
  /* eslint-enable no-await-in-loop */

  // Summary
  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  console.log(`\n${'='.repeat(60)}`)
  console.log('Download Summary')
  console.log('='.repeat(60))
  console.log(`Total files: ${totalFiles}`)
  console.log(`✓ Successful: ${successful}`)
  console.log(`✗ Failed: ${failed}`)
  console.log(`Output directory: ${outputDir}`)

  if (failed > 0) {
    console.log('\nFailed downloads:')
    results.filter((r) => !r.success).forEach((r) => {
      console.log(`  - ${r.key}: ${r.error.message}`)
    })
  }
}

/**
 * Main execution function
 */
const main = async () => {
  console.log('AWS S3 RDF Files Downloader')
  console.log('===========================\n')

  // Ensure required directories exist before starting
  try {
    mkdirSync(outputDir, { recursive: true })
  } catch (error) {
    console.error('✗ Failed to create the output directory:', error.message)
    process.exit(1)
  }

  console.log('Configuration loaded from environment variables.')
  console.log('You can set these in archive-processor/scripts/scripts-config.sh and run `source archive-processor/scripts/scripts-config.sh`\n')
  console.log(`Bucket: ${bucketName}`)
  console.log(`Region: ${region}`)
  console.log(`Output: ${outputDir}`)
  console.log(`Delay between downloads: ${downloadDelayMs}ms`)

  if (awsProfile) {
    console.log(`Profile: ${awsProfile}`)
  }

  if (toBeDownloadedVersions) {
    console.log(`Versions to download: ${toBeDownloadedVersions}`)
  } else {
    console.log('Versions to download: All versions')
  }

  try {
    await downloadAllRdfFiles()
    console.log('\n✓ Download completed successfully!')
  } catch (error) {
    console.error('\n✗ Failed to download RDF files:', error.message)

    if (error.name === 'InvalidAccessKeyId' || error.name === 'CredentialsProviderError') {
      console.error('\n⚠️  AWS Credentials Error:')
      console.error('Please configure your AWS credentials. Run with:')
      console.error('   AWS_PROFILE=kms-sit node scripts/downloadRdfFiles.js')
    }

    process.exit(1)
  }
}

// Execute the script
main()
