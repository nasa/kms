import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'

import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Handler for exporting RDF data to Amazon S3.
 *
 * This function is designed to be invoked on a schedule. It initiates the export process
 * asynchronously.
 *
 * Environment Variables:
 * - RDF_BUCKET_NAME: The name of the S3 bucket to use. Defaults to 'kms-rdf-backup' if not set.
 *
 * @async
 * @function handler
 * @param {Object} event - The event object containing the schedule information.
 * @param {string} event.version - The version of the RDF data to export (e.g., 'published', 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode: HTTP status code (202 for accepted)
 *   - body: A JSON string with a message indicating the export process has been initiated
 */
export const handler = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const version = event.version || 'published' // Default to 'published' if not specified

  try {
    const s3BucketName = process.env.RDF_BUCKET_NAME || 'kms-rdf-backup'
    const s3Client = new S3Client({})

    // Fetch RDF data from the repository using sparqlRequest
    const response = await sparqlRequest({
      method: 'GET',
      path: '/statements',
      accept: 'application/rdf+xml',
      version
    })

    const { versionName } = getVersionMetadata(version)

    if (!response.ok) {
      console.log('error fetching rdfxml for ', version)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const rdfData = await response.text()

    // Generate the S3 key based on the current date and version

    let s3Key
    if (version === 'published') {
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
