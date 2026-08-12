import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'

/**
 * S3 bucket name to download the concept scheme CSV from
 * @type {string}
 */
const bucketName = process.env.S3_BUCKET_NAME || 'kms-rdf-backup-sit'

/**
 * S3 Client from shared configuration
 * @type {S3Client}
 */
const s3Client = getS3Client()

/**
 * Lists all object keys directly under a version's S3 prefix.
 *
 * @param {string} versionPrefix - The "{version}/" prefix to list under.
 * @returns {Promise<Array<string>>} Array of full S3 object keys.
 */
const listKeysUnderPrefix = async (versionPrefix) => {
  const keys = []
  let continuationToken

  /* eslint-disable no-await-in-loop */
  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: versionPrefix,
      ContinuationToken: continuationToken
    })

    const response = await s3Client.send(command)

    if (response.Contents) {
      keys.push(...response.Contents.map((obj) => obj.Key).filter(Boolean))
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  /* eslint-enable no-await-in-loop */

  return keys
}

/**
 * Finds the actual S3 key for a scheme's CSV file under a version prefix,
 * matching case-insensitively since scheme file names in S3 may be
 * lowercase, CamelCase, or any other casing.
 *
 * @param {Array<string>} keys - Object keys under the version prefix.
 * @param {string} versionPrefix - The "{version}/" prefix the keys live under.
 * @param {string} scheme - The lowercased scheme name to match against.
 * @returns {string|undefined} The matching S3 key, if found.
 */
const findSchemeKey = (keys, versionPrefix, scheme) => keys.find((key) => {
  const fileName = key.slice(versionPrefix.length)

  return fileName.toLowerCase() === `${scheme}.csv`
})

export const getHistoricalConceptsInScheme = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  const { pathParameters, queryStringParameters } = event
  const { conceptScheme } = pathParameters || {}
  const scheme = conceptScheme?.toLowerCase()
  const { version } = queryStringParameters || {}

  if (!scheme) {
    return {
      statusCode: 400,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'scheme is required' })
    }
  }

  if (!version) {
    return {
      statusCode: 400,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'version is required' })
    }
  }

  const versionPrefix = `${version}/`

  try {
    const keys = await listKeysUnderPrefix(versionPrefix)
    const matchedKey = findSchemeKey(keys, versionPrefix, scheme)

    if (!matchedKey) {
      return {
        statusCode: 404,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: `No concept scheme "${scheme}" found for version "${version}"` })
      }
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: matchedKey
    })

    const response = await s3Client.send(command)

    if (!response.Body) {
      throw new Error('No data returned from S3')
    }

    const csvContent = await response.Body.transformToString()

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${scheme}.csv"`
      },
      body: csvContent
    }
  } catch (error) {
    console.error(`Failed to download CSV for scheme="${scheme}", version="${version}": ${error.message}`)

    return {
      statusCode: 500,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Failed to fetch concept scheme CSV' })
    }
  }
}

export default getHistoricalConceptsInScheme
