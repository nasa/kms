import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'

/**
 * Creates an SNS client for either real AWS or a LocalStack endpoint override.
 *
 * @returns {SNSClient} Configured SNS client instance.
 */
const createSnsClient = () => {
  const endpoint = process.env.AWS_ENDPOINT_URL
  const config = endpoint
    ? {
      endpoint,
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
      }
    }
    : {}

  return new SNSClient(config)
}

const snsClient = createSnsClient()

/**
 * Publishes a metadata correction request to the configured metadata correction topic.
 *
 * @param {Record<string, unknown>} metadataCorrectionRequest - Request payload to publish.
 * @returns {Promise<{messageId: string | undefined, message: string, messageGroupId: string, topicArn: string}>}
 * Metadata describing the publish request and SNS response.
 * @throws {Error} When the metadata correction requests topic ARN is not configured.
 * @throws {Error} When the collection concept id is missing.
 */
export const publishMetadataCorrectionRequest = async (metadataCorrectionRequest) => {
  const topicArn = process.env.METADATA_CORRECTION_REQUESTS_TOPIC_ARN

  if (!topicArn) {
    throw new Error('Missing METADATA_CORRECTION_REQUESTS_TOPIC_ARN')
  }

  /*
   * FIFO ordering is scoped by MessageGroupId. Grouping by collection concept id prevents
   * concurrent correction writes for the same collection while still allowing different
   * collections to be corrected in parallel.
   *
   * Same collection group, processed in order:
   * C123 -> message 1
   * C123 -> message 2
   * C123 -> message 3
   *
   * Different collection groups, processed independently:
   * C123 -> message 1
   * C456 -> message 1
   * C789 -> message 1
   *
   * Keep this queue contract to one collectionConceptId per message. If a keyword event
   * affects multiple collections, publish one message per collection so separate keyword
   * events that touch the same collection are serialized through the same group.
   */
  const messageGroupId = metadataCorrectionRequest.collectionConceptId

  if (!messageGroupId) {
    throw new Error('Missing metadata correction collectionConceptId')
  }

  const message = JSON.stringify(metadataCorrectionRequest)

  const response = await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Message: message,
    MessageGroupId: String(messageGroupId)
  }))

  return {
    messageId: response.MessageId,
    message,
    messageGroupId: String(messageGroupId),
    topicArn
  }
}

export default publishMetadataCorrectionRequest
