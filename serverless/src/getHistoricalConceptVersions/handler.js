import { ListObjectsV2Command } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'

/**
 * S3 bucket name to list version directories from
 * @type {string}
 */
const bucketName = process.env.S3_BUCKET_NAME || 'kms-rdf-backup-sit'

/**
 * S3 Client from shared configuration
 * @type {S3Client}
 */
const s3Client = getS3Client()

/**
 * Lists top-level "directory" names in the S3 bucket by using a delimiter
 * so S3 groups keys into CommonPrefixes (its equivalent of folders),
 * excluding the "draft/" prefix.
 *
 * @returns {Promise<Array<string>>} Array of version/directory names
 */
const listVersionDirectories = async () => {
  const historicalVersions = []
  let continuationToken

  /* eslint-disable no-await-in-loop */
  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Delimiter: '/',
      ContinuationToken: continuationToken
    })

    const response = await s3Client.send(command)

    if (response.CommonPrefixes) {
      const prefixes = response.CommonPrefixes
        .map((p) => p.Prefix)
        .filter(Boolean)
        .map((prefix) => prefix.replace(/\/$/, '')) // Strip trailing slash
        .filter((name) => name !== 'draft') // Exclude the draft "directory"

      historicalVersions.push(...prefixes)
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  /* eslint-enable no-await-in-loop */

  return historicalVersions
}

export const getHistoricalConceptVersions = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  try {
    const historicalVersions = await listVersionDirectories()

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ historicalVersions })
    }
  } catch (error) {
    console.error('Failed to list S3 version directories:', error.message)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Failed to fetch version directories' })
    }
  }
}

export default getHistoricalConceptVersions
