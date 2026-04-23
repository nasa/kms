import { PublishCommand } from '@aws-sdk/client-sns'

import { getSnsClient } from '@/shared/awsClients'

const snsClient = getSnsClient()

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
