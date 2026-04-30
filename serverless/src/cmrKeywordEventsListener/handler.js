import { getCmrCollectionConceptIds } from '@/shared/getCmrCollectionConceptIds'
import { logger } from '@/shared/logger'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'

/**
 * Builds a metadata correction request for a specific affected collection.
 *
 * @param {string} collectionConceptId - Affected CMR collection concept id.
 * @param {Record<string, unknown>} keywordEvent - Parsed KMS keyword event.
 * @returns {Record<string, unknown>} Metadata correction request payload.
 */
const buildMetadataCorrectionRequest = (collectionConceptId, keywordEvent) => {
  const {
    EventType: eventType,
    Scheme: scheme,
    UUID: uuid,
    OldKeywordPath: oldKeywordPath,
    NewKeywordPath: newKeywordPath,
    Timestamp: timestamp
  } = keywordEvent

  return {
    source: 'cmrKeywordEventsListener',
    collectionConceptId,
    keywordEvent: {
      eventType,
      scheme,
      uuid,
      oldKeywordPath,
      newKeywordPath,
      timestamp
    }
  }
}

const LOOKUP_ELIGIBLE_EVENT_TYPES = new Set([
  'UPDATED',
  'DELETED'
])

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
      const {
        body,
        messageId
      } = record
      const snsEnvelope = JSON.parse(body || '{}')
      const keywordEvent = snsEnvelope.Message
        ? JSON.parse(snsEnvelope.Message)
        : null

      const {
        EventType: eventType,
        Scheme: scheme,
        UUID: uuid
      } = keywordEvent || {}
      const keywordEventType = String(eventType || '').toUpperCase()

      logger.info(
        '[consumer] Received keyword event for CMR listener '
        + `messageId=${messageId || 'n/a'} `
        + `eventType=${eventType || 'n/a'} `
        + `scheme=${scheme || 'n/a'} `
        + `uuid=${uuid || 'n/a'}`
      )

      if (keywordEvent && LOOKUP_ELIGIBLE_EVENT_TYPES.has(keywordEventType)) {
        const collectionConceptIds = await getCmrCollectionConceptIds({
          scheme,
          uuid
        })

        logger.info(
          '[consumer] Found collection concept ids for metadata correction '
          + `scheme=${scheme} `
          + `uuid=${uuid} `
          + `count=${collectionConceptIds.length}`
        )

        if (collectionConceptIds.length === 0) {
          logger.info(
            '[consumer] No affected collection concept ids found for keyword event '
            + `scheme=${scheme} `
            + `uuid=${uuid}`
          )
        }

        await Promise.all(collectionConceptIds.map(async (collectionConceptId) => {
          const metadataCorrectionRequest = buildMetadataCorrectionRequest(
            collectionConceptId,
            keywordEvent
          )
          const publishResult = await publishMetadataCorrectionRequest(metadataCorrectionRequest)

          logger.info(
            '[consumer] Published metadata correction request '
            + `collectionConceptId=${metadataCorrectionRequest.collectionConceptId} `
            + `messageId=${publishResult.messageId || 'n/a'} `
            + `topicArn=${publishResult.topicArn || 'n/a'}`
          )
        }))
      } else if (keywordEvent) {
        logger.info(
          '[consumer] Skipping metadata correction concept-id lookup for event type '
          + `eventType=${eventType || 'n/a'} `
          + `scheme=${scheme || 'n/a'} `
          + `uuid=${uuid || 'n/a'}`
        )
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
