import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'

import { ensureBucketAndLifecycleRule } from '@/shared/ensureBucketAndLifeCycleRule'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Handler for exporting RDF data to Amazon S3.
 *
 * This function is designed to be invoked on a schedule or on-demand. It exports RDF data
 * to an S3 bucket, with different behaviors for 'published' and 'draft' version.
 *
 * For 'published' version:
 * - Creates a file at `{versionName}/rdf.xml`
 * - Overwrites existing file if present
 *
 * For 'draft' version:
 * - Creates a new file with a date-based path: `draft/{year}/{month}/{day}/rdf.xml`
 * - A new file is created each time, preserving historical versions
 *
 * The function will create the S3 bucket if it doesn't exist.
 *
 * Environment Variables:
 * - RDF_BUCKET_NAME: The name of the S3 bucket to use. Defaults to 'kms-rdf-backup' if not set.
 *
 * @async
 * @function handler
 * @param {Object} event - The event object containing the export information.
 * @param {string} [event.version='published'] - The version of the RDF data to export (e.g., 'published', 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode: HTTP status code (200 for success, 500 for error)
 *   - headers: Response headers
 *   - body: A JSON string with a message indicating the result of the export process
 * @throws Will throw an error if the RDF data fetch fails or if there are issues with S3 operations.
 */
export const handler = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const version = event.version || 'published' // Default to 'published' if not specified

  try {
    const s3BucketName = process.env.RDF_BUCKET_NAME || 'kms-rdf-backup'
    const s3Client = new S3Client({})

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

    // Generate the S3 key based on the current date and version

    let s3Key
    if (version === 'published') {
      const { versionName } = await getVersionMetadata(version)
      s3Key = `${versionName}/rdf.xml`
    } else {
      const currentDate = new Date()
      const year = currentDate.getUTCFullYear()
      const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0')
      const day = String(currentDate.getUTCDate()).padStart(2, '0')
      s3Key = `${version}/${year}/${month}/${day}/rdf.xml`
    }

    // Check if bucket exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: s3BucketName }))
    } catch (error) {
      if (error.name === 'NotFound') {
        console.log(`Bucket ${s3BucketName} not found. Creating...`)
        await s3Client.send(new CreateBucketCommand({ Bucket: s3BucketName }))
      } else {
        throw error
      }
    }

    // Upload RDF data to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
      Body: rdfData,
      ContentType: 'application/rdf+xml'
    }))

    console.log(`RDF data for version ${version} exported successfully to ${s3Key}`)

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: `RDF export process complete for version ${version}` })
    }
  } catch (error) {
    console.error('Error in export process:', error)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error in RDF export process' })
    }
  }
}

export default handler
