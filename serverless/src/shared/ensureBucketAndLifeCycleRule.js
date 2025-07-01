import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand
} from '@aws-sdk/client-s3'

/**
 * Ensures that the specified S3 bucket exists and has the correct lifecycle rule applied.
 * If the bucket doesn't exist, it will be created. The lifecycle rule is set to expire
 * objects with the 'draft/' prefix after the specified number of days.
 *
 * @async
 * @function ensureBucketAndLifecycleRule
 * @param {S3Client} s3Client - The AWS S3 client instance to use for operations.
 * @param {string} bucketName - The name of the S3 bucket to ensure/configure.
 * @param {number} daysUntilExpiration - The number of days after which objects should expire.
 * @throws {Error} If there's an error creating the bucket or setting the lifecycle rule.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 *
 * @example
 * const s3Client = new S3Client({});
 * await ensureBucketAndLifecycleRule(s3Client, 'my-bucket', 30);
 */
export const ensureBucketAndLifecycleRule = async (s3Client, bucketName, daysUntilExpiration) => {
  // Check if bucket exists, create if it doesn't
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }))
    console.log(`Bucket ${bucketName} exists.`)
  } catch (error) {
    if (error.name === 'NotFound') {
      console.log(`Bucket ${bucketName} not found. Creating...`)
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }))
    } else {
      throw error
    }
  }

  // Set or update lifecycle rule
  const command = new PutBucketLifecycleConfigurationCommand({
    Bucket: bucketName,
    LifecycleConfiguration: {
      Rules: [
        {
          ID: 'ExpireDraftFiles',
          Status: 'Enabled',
          Filter: {
            Prefix: 'draft/'
          },
          Expiration: { Days: daysUntilExpiration }
        }
      ]
    }
  })

  try {
    await s3Client.send(command)
    console.log(`Lifecycle rule set/updated: Objects in 'draft/' will expire after ${daysUntilExpiration} days`)
  } catch (error) {
    console.error('Error setting/updating lifecycle rule:', error)
    throw error
  }
}
