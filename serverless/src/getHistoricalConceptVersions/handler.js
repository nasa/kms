import { paginateListObjectsV2 } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'

/**
 * S3 bucket name to list version directories from.
 * @type {string}
 */
const bucketName = process.env.RDF_BUCKET_NAME

if (!bucketName) {
  throw new Error('Missing required environment variable: RDF_BUCKET_NAME')
}

/**
 * S3 Client from shared configuration
 * @type {S3Client}
 */
const s3Client = getS3Client()

/**
 * Lists candidate version "directory" names in the S3 bucket by using a
 * delimiter so S3 groups keys into CommonPrefixes (its equivalent of
 * folders), excluding the "draft/" prefix.
 *
 * @returns {Promise<Array<string>>} Array of candidate version/directory names
 */
const listCandidateVersions = async () => {
  const candidateVersions = []

  const paginator = paginateListObjectsV2(
    {
      client: s3Client,
      pageSize: 1000
    },
    {
      Bucket: bucketName,
      Delimiter: '/'
    }
  )

  // eslint-disable-next-line no-restricted-syntax
  for await (const page of paginator) {
    if (page.CommonPrefixes) {
      const prefixes = page.CommonPrefixes
        .map((p) => p.Prefix)
        .filter(Boolean)
        .map((prefix) => prefix.replace(/\/$/, '')) // Strip trailing slash
        .filter((name) => name !== 'draft') // Exclude the draft "directory"

      candidateVersions.push(...prefixes)
    }
  }

  return candidateVersions
}

/**
 * Checks whether a given version "directory" contains at least one
 * downloadable CSV file. A version may exist as a top-level prefix while
 * only containing an rdf.xml export (or an incomplete export with no CSVs
 * at all), so this is used to filter those out.
 *
 * @param {string} version - Version/directory name, e.g. "1.9.1"
 * @returns {Promise<boolean>} Whether the version contains at least one .csv key
 */
const versionHasCsv = async (version) => {
  const paginator = paginateListObjectsV2(
    {
      client: s3Client,
      pageSize: 1000
    },
    {
      Bucket: bucketName,
      Prefix: `${version}/`
    }
  )

  // eslint-disable-next-line no-restricted-syntax
  for await (const page of paginator) {
    if (page.Contents?.some((object) => object.Key.endsWith('.csv'))) {
      return true
    }
  }

  return false
}

/**
 * Lists top-level "directory" names in the S3 bucket, excluding the
 * "draft/" prefix, and excluding any version that has no downloadable CSV
 * files (e.g. rdf.xml-only or incomplete exports).
 *
 * @returns {Promise<Array<string>>} Array of version/directory names
 */
const listVersionDirectories = async () => {
  const candidateVersions = await listCandidateVersions()

  const versionCsvChecks = await Promise.all(
    candidateVersions.map(async (version) => ({
      version,
      hasCsv: await versionHasCsv(version)
    }))
  )

  return versionCsvChecks
    .filter((result) => result.hasCsv)
    .map((result) => result.version)
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
