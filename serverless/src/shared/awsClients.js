import { EventBridgeClient } from '@aws-sdk/client-eventbridge'
import { S3Client } from '@aws-sdk/client-s3'
import { SNSClient } from '@aws-sdk/client-sns'

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
export const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client(getClientConfig())
  }

  return s3Client
}

let eventBridgeClient
export const getEventBridgeClient = () => {
  if (!eventBridgeClient) {
    eventBridgeClient = new EventBridgeClient(getClientConfig())
  }

  return eventBridgeClient
}

let snsClient
export const getSnsClient = () => {
  if (!snsClient) {
    snsClient = new SNSClient(getClientConfig())
  }

  return snsClient
}
