import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'

import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Handler for exporting RDF data to Amazon S3.
 *
 * This function performs the following operations:
 * 1. Retrieves RDF data from a SPARQL endpoint.
 * 2. Generates a unique S3 key based on the current date.
 * 3. Checks if the specified S3 bucket exists, creates it if it doesn't.
 * 4. Uploads the RDF data to the S3 bucket.
 *
 * Environment Variables:
 * - RDF_BUCKET_NAME: The name of the S3 bucket to use. Defaults to 'kms-rdf-backup' if not set.
 *
 * @async
 * @function handler
 * @returns {Object} An object containing:
 *   - statusCode: HTTP status code (200 for success, 500 for error)
 *   - headers: Response headers
 *   - body: A JSON string containing a message and the S3 key (for successful exports)
 *
 * @throws Will throw an error if:
 *   - The SPARQL request fails
 *   - There's an error creating the S3 bucket
 *   - There's an error uploading to S3
 *
 * Usage:
 * This handler can be invoked via an HTTP POST request or on a schedule (daily at midnight UTC).
 *
 * S3 Key Format:
 * The S3 key is generated in the format: YYYY/MM/DD/rdf.xml
 *
 * Error Handling:
 * If any error occurs during the process, it logs the error and returns a 500 status code.
 */
export const handler = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const s3BucketName = process.env.RDF_BUCKET_NAME || 'kms-rdf-backup'

  const s3Client = new S3Client({})

  try {
    // Fetch RDF data from the repository using sparqlRequest
    const response = await sparqlRequest({
      method: 'GET',
      path: '/statements',
      accept: 'application/rdf+xml'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const rdfData = await response.text()

    // Generate the S3 key based on the current date
    const currentDate = new Date()
    const year = currentDate.getUTCFullYear()
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getUTCDate()).padStart(2, '0')
    const s3Key = `${year}/${month}/${day}/rdf.xml`

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

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'RDF data exported successfully',
        s3Key
      })
    }
  } catch (error) {
    console.error('Error exporting RDF data:', error)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error exporting RDF data' })
    }
  }
}

export default handler
