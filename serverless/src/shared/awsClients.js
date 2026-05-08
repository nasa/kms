import { EventBridgeClient } from '@aws-sdk/client-eventbridge'
import { S3Client } from '@aws-sdk/client-s3'
import { SNSClient } from '@aws-sdk/client-sns'

/**
 * Builds the shared AWS SDK client configuration for KMS.
 *
 * In deployed environments this returns an empty object so the SDK uses its normal AWS runtime
 * configuration. In local SAM/LocalStack flows it applies the endpoint override plus the dummy
 * credentials and path-style behavior LocalStack expects.
 *
 * @returns {object} AWS SDK client configuration.
 */
const getClientConfig = () => {
  const endpoint = process.env.AWS_ENDPOINT_URL
  const config = endpoint
    ? {
      endpoint,
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    }
    : {}

  if (endpoint) {
    config.forcePathStyle = true
  }

  return config
}

let s3Client

/**
 * Returns a shared S3 client instance for the current process.
 *
 * @returns {S3Client} Lazily created S3 client.
 */
export const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client(getClientConfig())
  }

  return s3Client
}

let eventBridgeClient

/**
 * Returns a shared EventBridge client instance for the current process.
 *
 * @returns {EventBridgeClient} Lazily created EventBridge client.
 */
export const getEventBridgeClient = () => {
  if (!eventBridgeClient) {
    eventBridgeClient = new EventBridgeClient(getClientConfig())
  }

  return eventBridgeClient
}

let snsClient

/**
 * Returns a shared SNS client instance for the current process.
 *
 * @returns {SNSClient} Lazily created SNS client.
 */
export const getSnsClient = () => {
  if (!snsClient) {
    snsClient = new SNSClient(getClientConfig())
  }

  return snsClient
}
