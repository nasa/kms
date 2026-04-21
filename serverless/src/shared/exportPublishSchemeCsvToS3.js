import { PutObjectCommand } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logger } from '@/shared/logger'

const s3 = getS3Client()

const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * For all published schemes, downloads the concepts as CSV and uploads them to an S3 bucket.
 * The bucket is determined by the environment, and the key includes the published version name.
 * @returns {Promise<void>}
 */
export const exportPublishSchemeCsvToS3 = async () => {
  const s3ExportDelayMs = parseInt(process.env.S3_EXPORT_DELAY_MS || '100', 10)
  const env = process.env.NODE_ENV || 'dev'
  const bucketName = `kms-rdf-backup-${env}`

  try {
    const { versionName } = await getVersionMetadata('published')
    if (!versionName) {
      throw new Error('Could not determine published version name.')
    }

    logger.info(`Exporting published CSVs for version: ${versionName}`)

    const schemes = await getConceptSchemeDetails({ version: 'published' })
    if (!schemes || schemes.length === 0) {
      logger.warn('No published concept schemes found to export.')

      return
    }

    logger.info(`Found ${schemes.length} published schemes to export.`)

    await schemes.reduce((previousPromise, scheme, index) => previousPromise.then(async () => {
      const { notation } = scheme
      try {
        logger.info(`Downloading CSV for scheme: ${notation}`)
        const csvData = await downloadConcepts({
          conceptScheme: notation,
          format: 'csv',
          version: 'published'
        })

        const s3Key = `${versionName}/${notation}.csv`

        logger.info(`Uploading ${notation}.csv to s3://${bucketName}/${s3Key}`)

        await s3.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: csvData,
          ContentType: 'text/csv'
        }))

        logger.info(`Successfully uploaded ${notation}.csv to S3.`)

        if (s3ExportDelayMs > 0 && index < schemes.length - 1) {
          await delay(s3ExportDelayMs)
        }
      } catch (error) {
        logger.error(`Failed to process scheme ${notation}: ${error.message}`)
      }
    }), Promise.resolve())

    logger.info('Finished exporting all published scheme CSVs to S3.')
  } catch (error) {
    logger.error(`Error in exportPublishSchemeCsvToS3: ${error.message}`)
    throw error
  }
}

export default exportPublishSchemeCsvToS3
