import { createReadStream, mkdirSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import {
  dirname,
  join,
  relative
} from 'path'
import { fileURLToPath } from 'url'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)

/**
 * AWS Region for the S3 bucket
 * @type {string}
 */
const region = process.env.AWS_REGION || 'us-east-1'

/**
 * S3 bucket name to upload files to
 * @type {string}
 */
const bucketName = process.env.S3_BUCKET_NAME || 'kms-rdf-backup-sit'

/**
 * AWS Profile to use (optional)
 * @type {string|undefined}
 */
const awsProfile = process.env.AWS_PROFILE

/**
 * Input directory for CSV files
 * @type {string}
 */
const inputDir = join(scriptDir, '..', 'local-kms-csv')

/**
 * Delay in milliseconds between uploads to avoid rate limiting
 * Default: 100ms (configurable via UPLOAD_DELAY_MS environment variable)
 * Set to 0 to disable delay
 * @type {number}
 */
const uploadDelayMs = parseInt(process.env.UPLOAD_DELAY_MS || '100', 10)

/**
 * Optional comma-separated list of specific versions to upload.
 * If empty, the script will upload all CSV files from all version folders.
 * @type {string}
 */
const toBeUploadedVersions = process.env.TO_BE_UPLOADED_VERSIONS || ''

/**
 * S3 Client configured for the specified region
 * @type {S3Client}
 */
const s3Client = new S3Client({
  region,
  ...(awsProfile && { credentials: undefined })
})

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
 * Uploads a single CSV file to S3
 *
 * @param {string} filePath - Path to the local CSV file
 * @param {number} index - Current file index (for progress display)
 * @param {number} total - Total number of files to upload
 * @returns {Promise<{success: boolean, filePath: string, s3Key?: string, error?: Error}>}
 */
const uploadCsvFile = async (filePath, index, total) => {
  // Construct the S3 key from the file path relative to the input directory
  // e.g., local-kms-csv/10.0/file.csv -> 10.0/file.csv
  const s3Key = relative(inputDir, filePath).replace(/\\/g, '/')

  try {
    console.log(`[${index}/${total}] Uploading: ${filePath} -> s3://${bucketName}/${s3Key}`)

    const fileStream = createReadStream(filePath)

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: fileStream
    })

    await s3Client.send(command)

    console.log(`[${index}/${total}] ✓ Uploaded: ${s3Key}`)

    return {
      success: true,
      filePath,
      s3Key
    }
  } catch (error) {
    console.error(`[${index}/${total}] ✗ Failed to upload ${filePath}:`, error.message)

    return {
      success: false,
      filePath,
      error
    }
  }
}

/**
 * Finds all CSV files in the specified directory, optionally filtered by version.
 *
 * @param {string} dir - The base directory to search in.
 * @param {string[]} versionList - An array of specific versions to look for. If empty, searches all subdirectories.
 * @returns {Promise<string[]>} A list of file paths.
 */
const findCsvFiles = async (dir, versionList) => {
  let dirsToSearch = []

  if (versionList.length > 0) {
    // If specific versions are provided, only look in those directories
    dirsToSearch = versionList.map((v) => join(dir, v))
  } else {
    // Otherwise, list all items in the base directory
    const topLevelItems = await readdir(dir)
    // Assume all items in the base directory are version folders
    dirsToSearch = await Promise.all(topLevelItems.map(async (item) => {
      const fullPath = join(dir, item)
      const stats = await stat(fullPath)

      return stats.isDirectory() ? fullPath : null
    })).then((results) => results.filter(Boolean))
  }

  console.log(`Searching for CSV files in: ${dirsToSearch.join(', ')}`)

  const filePromises = dirsToSearch.map(async (versionDir) => {
    try {
      const dirItems = await readdir(versionDir)

      return dirItems
        .filter((item) => item.endsWith('.csv'))
        .map((item) => join(versionDir, item))
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`Warning: Directory not found, skipping: ${versionDir}`)

        return [] // Return an empty array for non-existent directories
      }

      throw err // Re-throw other errors
    }
  })

  const filesByDir = await Promise.all(filePromises)

  return filesByDir.flat()
}

/**
 * Main function to upload all CSV files
 *
 * @returns {Promise<void>}
 */
const uploadAllCsvFiles = async () => {
  const versionList = toBeUploadedVersions.split(',').map((v) => v.trim()).filter(Boolean)

  console.log('Finding CSV files to upload...')
  const filesToUpload = await findCsvFiles(inputDir, versionList)

  if (filesToUpload.length === 0) {
    console.log('No CSV files found to upload.')

    return
  }

  const totalFiles = filesToUpload.length

  console.log(`\nStarting upload of ${totalFiles} CSV files...`)
  console.log(`Input directory: ${inputDir}\n`)

  const results = await filesToUpload.reduce(async (previousPromise, filePath, index) => {
    const accResults = await previousPromise

    const result = await uploadCsvFile(filePath, index + 1, totalFiles)

    if (uploadDelayMs > 0 && index < totalFiles - 1) {
      await delay(uploadDelayMs)
    }

    return [...accResults, result]
  }, Promise.resolve([]))

  // Summary
  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  console.log(`\n${'='.repeat(60)}`)
  console.log('Upload Summary')
  console.log('='.repeat(60))
  console.log(`Total files: ${totalFiles}`)
  console.log(`✓ Successful: ${successful}`)
  console.log(`✗ Failed: ${failed}`)
  console.log(`Target bucket: ${bucketName}`)

  if (failed > 0) {
    console.log('\nFailed uploads:')
    results.filter((r) => !r.success).forEach((r) => {
      console.log(`  - ${r.filePath}: ${r.error.message}`)
    })
  }
}

/**
 * Main execution function
 */
const main = async () => {
  console.log('AWS S3 CSV Files Uploader')
  console.log('========================\n')

  // Ensure required directories exist before starting
  try {
    mkdirSync(inputDir, { recursive: true })
  } catch (error) {
    console.error('✗ Failed to create the input directory:', error.message)
    process.exit(1)
  }

  console.log('Configuration loaded from environment variables.')
  console.log('You can set these in archive-processor/scripts/scripts-config.sh and run `source archive-processor/scripts/scripts-config.sh`\n')
  console.log(`Bucket: ${bucketName}`)
  console.log(`Region: ${region}`)
  console.log(`Input: ${inputDir}`)
  console.log(`Delay between uploads: ${uploadDelayMs}ms`)

  if (awsProfile) {
    console.log(`Profile: ${awsProfile}`)
  }

  if (toBeUploadedVersions) {
    console.log(`Versions to upload: ${toBeUploadedVersions}`)
  } else {
    console.log('Versions to upload: All versions')
  }

  console.log('\n')

  try {
    await uploadAllCsvFiles()
    console.log('\n✓ Upload completed successfully!')
  } catch (error) {
    console.error('\n✗ Failed to upload CSV files:', error.message)

    if (error.name === 'InvalidAccessKeyId' || error.name === 'CredentialsProviderError') {
      console.error('\n⚠️  AWS Credentials Error:')
      console.error('Please configure your AWS credentials.')
    }

    process.exit(1)
  }
}

// Execute the script
main()
