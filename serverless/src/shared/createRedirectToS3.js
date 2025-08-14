import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { ensureBucketAndLifecycleRule } from './ensureBucketAndLifeCycleRule'

export const createRedirectToS3 = async (content, contentType) => {
  const s3Client = new S3Client({})
  const s3BucketName = process.env.GET_CONCEPTS_BUCKET_NAME || 'get-concepts'
  const contentSize = Buffer.byteLength(content)
  const objectKey = `concepts-${Date.now()}-${contentSize}`

  await ensureBucketAndLifecycleRule(s3Client, s3BucketName, 1, '')

  // Upload the response to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: s3BucketName,
    Key: objectKey,
    Body: content,
    ContentType: contentType
  }))

  // Generate a pre-signed URL which will expire in 10 minutes
  const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: s3BucketName,
    Key: objectKey
  }), { expiresIn: 600 })

  return signedUrl
}
