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
 * Publishes a keyword event payload to the configured SNS topic.
 *
 * @param {Record<string, unknown>} keywordEvent - Keyword event payload to serialize and publish.
 * @returns {Promise<{messageId: string | undefined, message: string, topicArn: string}>}
 * Metadata describing the publish request and SNS response.
 * @throws {Error} When the keyword events topic ARN is not configured.
 */
export const publishKeywordEvent = async (keywordEvent) => {
  const topicArn = process.env.KEYWORD_EVENTS_TOPIC_ARN

  if (!topicArn) {
    throw new Error('Missing KEYWORD_EVENTS_TOPIC_ARN')
  }

  const message = JSON.stringify(keywordEvent)

  const response = await snsClient.send(new PublishCommand({
    TopicArn: topicArn,
    Message: message
  }))

  return {
    messageId: response.MessageId,
    message,
    topicArn
  }
}

export default publishKeywordEvent
