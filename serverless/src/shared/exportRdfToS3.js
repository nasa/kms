import { promisify } from 'util'
import zlib from 'zlib'

import { PutObjectCommand } from '@aws-sdk/client-s3'

import { getS3Client } from '@/shared/awsClients'
import { ensureBucketAndLifecycleRule } from '@/shared/ensureBucketAndLifeCycleRule'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sparqlRequest } from '@/shared/sparqlRequest'

const gzip = promisify(zlib.gzip)

/**
 * Exports RDF data to an S3 bucket.
 *
 * This function exports RDF data to an S3 bucket, with different behaviors for 'published' and 'draft' versions.
 *
 * For 'published' version:
 * - Creates a file at `{versionName}/rdf.xml`
 * - Overwrites existing file if present
 *
 * For 'draft' version:
 * - Creates a new file with a date-based path: `draft/{year}/{month}/{day}/rdf.xml`
 * - A new file is created each time, preserving historical versions
 *
 * The function will create the S3 bucket if it doesn't exist using the stage name
 * as part of the bucket name, e.g., kms-rdf-backup-${env}
 *
 * @async
 * @function exportRdfToS3
 * @param {Object} params - The parameters for the export.
 * @param {string} params.version - The RDF graph to export (`published` or `draft`).
 * @param {boolean} [params.archive=false] - Whether to compress the RDF with gzip.
 * @returns {Promise<{bucketName: string, s3Key: string}>} The exported object's location.
 * @throws Will throw an error if the RDF data fetch fails or if there are issues with S3 operations.
 */
export const exportRdfToS3 = async ({ version, archive = false }) => {
  if (!['draft', 'published'].includes(version)) {
    throw new Error(`Unsupported RDF version: ${version}`)
  }

  const { env } = getApplicationConfig()
  const s3BucketName = `kms-rdf-backup-${env}`
  const s3Client = getS3Client()

  // Ensure bucket exists and lifecycle rule is set
  await ensureBucketAndLifecycleRule(s3Client, s3BucketName, 30, 'draft/') // Expire after 30 days

  // Fetch RDF data from the repository using sparqlRequest
  const response = await sparqlRequest({
    method: 'GET',
    path: '/statements',
    accept: 'application/rdf+xml',
    version
  })

  if (!response.ok) {
    console.log('error fetching rdfxml for ', version)
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const rdfData = await response.text()

  const fileName = archive ? 'rdf.xml.gz' : 'rdf.xml'

  // Generate the S3 key based on the current date and version
  let s3Key
  if (version === 'published') {
    const { versionName } = await getVersionMetadata(version)
    s3Key = `${versionName}/${fileName}`
  } else {
    const currentDate = new Date()
    const year = currentDate.getUTCFullYear()
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getUTCDate()).padStart(2, '0')
    s3Key = `${version}/${year}/${month}/${day}/${fileName}`
  }

  const body = archive ? await gzip(rdfData) : rdfData

  // Upload RDF data to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: s3BucketName,
    Key: s3Key,
    Body: body,
    ContentType: archive ? 'application/gzip' : 'application/rdf+xml'
  }))

  console.log(`RDF data for version ${version} exported successfully to ${s3Key}`)

  return {
    bucketName: s3BucketName,
    s3Key
  }
}
