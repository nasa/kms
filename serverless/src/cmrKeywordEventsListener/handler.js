import { logger } from '@/shared/logger'

/**
 * CMR event processor that consumes SNS notifications delivered through SQS.
 *
 * The queue record body contains the SNS envelope, whose `Message` field contains the
 * original keyword event JSON published by KMS.
 *
 * @param {{ Records?: Array<{ body?: string, messageId?: string }> }} event - SQS batch event.
 * @returns {Promise<{batchItemFailures: Array}>} Empty batch failures so successfully parsed
 * records are acknowledged.
 */
export const cmrKeywordEventsListener = async (event) => {
  const records = event?.Records || []

  records.forEach((record) => {
    try {
      const snsEnvelope = JSON.parse(record.body || '{}')
      const keywordEvent = snsEnvelope.Message
        ? JSON.parse(snsEnvelope.Message)
        : null

      logger.info('[consumer] Received keyword event for CMR listener', {
        messageId: record.messageId,
        keywordEvent
      })
    } catch (error) {
      logger.error('Failed to parse keyword event record', error)
      throw error
    }
  })

  return {
    batchItemFailures: []
  }
}

export default cmrKeywordEventsListener
