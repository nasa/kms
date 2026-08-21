import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { getS3Client } from '@/shared/awsClients'
import { exportRdfToS3 } from '@/shared/exportRdfToS3'
import { getApplicationConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'

const DOWNLOAD_URL_EXPIRATION_SECONDS = 300

/**
 * Exports one RDF graph to private S3 gzip storage and returns a temporary download URL.
 *
 * @param {object} event - API Gateway event containing `version` as a query parameter.
 * @returns {Promise<object>} API Gateway response.
 */
export const exportRdf = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const version = event?.queryStringParameters?.version

  if (!['draft', 'published'].includes(version)) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        error: 'version query parameter must be draft or published'
      })
    }
  }

  try {
    const {
      bucketName,
      s3Key
    } = await exportRdfToS3({
      version,
      archive: true
    })

    const fileName = `kms-${version}-rdf.xml.gz`
    const downloadUrl = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
        ResponseContentType: 'application/gzip'
      }),
      { expiresIn: DOWNLOAD_URL_EXPIRATION_SECONDS }
    )

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version,
        downloadUrl,
        expiresIn: DOWNLOAD_URL_EXPIRATION_SECONDS
      })
    }
  } catch (error) {
    logger.error(`[rdf-export] Failed to create ${version} RDF export, error=${error.toString()}`)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        error: 'Unable to create RDF export'
      })
    }
  }
}

export default exportRdf
