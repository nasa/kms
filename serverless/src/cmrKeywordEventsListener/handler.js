import { logger } from '@/shared/logger'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'

/**
 * Placeholder collection concept id used until KMS-675A discovers real concept ids from CMR.
 * KMS-675A will replace this with concept ids discovered from CMR.
 *
 * @type {string}
 */
const METADATA_CORRECTION_CONCEPT_ID = 'C0000000000-KMS'

/**
 * Builds a metadata correction request so the SNS/SQS/consumer path can be tested before
 * CMR concept id lookup is implemented.
 *
 * TODO: Create a follow-up ticket to query CMR for every collection concept id that uses
 * the changed keyword. The listener should publish one metadata correction request per
 * collection concept id so FIFO ordering can protect corrections for the same collection.
 *
 * @param {Record<string, unknown>} keywordEvent - Parsed KMS keyword event.
 * @returns {Record<string, unknown>} Metadata correction request payload.
 */
const buildMetadataCorrectionRequest = (keywordEvent) => ({
  source: 'cmrKeywordEventsListener',
  collectionConceptId: METADATA_CORRECTION_CONCEPT_ID,
  keywordEvent: {
    eventType: keywordEvent.EventType,
    scheme: keywordEvent.Scheme,
    uuid: keywordEvent.UUID,
    oldKeywordPath: keywordEvent.OldKeywordPath,
    newKeywordPath: keywordEvent.NewKeywordPath,
    timestamp: keywordEvent.Timestamp
  }
})

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

  await Promise.all(records.map(async (record) => {
    try {
      const snsEnvelope = JSON.parse(record.body || '{}')
      const keywordEvent = snsEnvelope.Message
        ? JSON.parse(snsEnvelope.Message)
        : null

      logger.info('[consumer] Received keyword event for CMR listener', {
        messageId: record.messageId,
        keywordEvent
      })

      if (keywordEvent) {
        const metadataCorrectionRequest = buildMetadataCorrectionRequest(keywordEvent)
        const publishResult = await publishMetadataCorrectionRequest(metadataCorrectionRequest)

        logger.info('[consumer] Published metadata correction request', {
          collectionConceptId: metadataCorrectionRequest.collectionConceptId,
          messageId: publishResult.messageId,
          topicArn: publishResult.topicArn
        })
      }
    } catch (error) {
      logger.error('Failed to process keyword event record', error)
      throw error
    }
  }))

  return {
    batchItemFailures: []
  }
}

export default cmrKeywordEventsListener
