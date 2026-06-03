import { formatKeywordObjectForLog } from '@/shared/formatKeywordObjectForLog'
import { getCmrCollectionConceptIds } from '@/shared/getCmrCollectionConceptIds'
import { hasMeaningfulKeywordObject } from '@/shared/hasMeaningfulKeywordObject'
import { logger } from '@/shared/logger'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'

/**
 * Metadata-correction fanout listener for KMS keyword events.
 *
 * This Lambda sits between raw keyword change events and the per-collection metadata-correction
 * work. When KMS publishes an UPDATED or DELETED keyword event, this listener finds the CMR
 * collection concept ids that reference the affected keyword uuid and then publishes one
 * metadata-correction request for each impacted collection.
 *
 * In practice the flow is:
 * 1. consume the SNS message delivered through SQS
 * 2. parse the original keyword event payload
 * 3. ask CMR which collections reference that keyword uuid
 * 4. publish one collection-scoped metadata correction request per concept id
 *
 * This keeps keyword-event intake separate from the heavier collection fetch / validate /
 * resolve / delegate work performed by the metadata-correction service itself.
 */

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
    OldKeywordObject: oldKeywordObject,
    NewKeywordObject: newKeywordObject,
    Timestamp: timestamp
  } = keywordEvent

  return {
    source: 'cmrKeywordEventsListener',
    collectionConceptId,
    keywordEvent: {
      eventType,
      scheme,
      uuid,
      oldKeywordObject,
      newKeywordObject,
      timestamp
    }
  }
}

/**
 * Publishes one collection-scoped correction request per impacted collection concept id.
 *
 * @param {string[]} collectionConceptIds - Affected collection concept ids returned by CMR.
 * @param {Record<string, unknown>} keywordEvent - Raw parsed KMS keyword event.
 * @returns {Promise<void>} Resolves once all publish calls complete.
 */
const publishCollectionCorrectionRequests = async (collectionConceptIds, keywordEvent) => {
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
}

const LOOKUP_ELIGIBLE_EVENT_TYPES = new Set([
  'UPDATED',
  'DELETED'
])

/**
 * Chooses the keyword object used for listener logging and lookup tracing.
 *
 * This does not drive delete detection or the actual CMR collection lookup. The lookup itself is
 * UUID-driven; this keyword object is only carried through logs and lookup tracing so CloudWatch
 * output is easier to follow.
 *
 * Deleted events use the old keyword object, while other events use the new keyword object.
 *
 * @param {Record<string, unknown>|null|undefined} keywordEvent - Parsed KMS keyword event.
 * @returns {Record<string, unknown>|undefined} Preferred logging keyword object, if present.
 */
const getLookupKeywordObject = (keywordEvent) => {
  const normalizedEventType = String(keywordEvent?.EventType || '').toUpperCase()

  return normalizedEventType === 'DELETED'
    ? keywordEvent?.OldKeywordObject
    : keywordEvent?.NewKeywordObject
}

/**
 * Narrows an arbitrary thrown value into a logger-safe error payload.
 *
 * @param {unknown} error - Thrown error or error-like value.
 * @returns {Record<string, unknown>|undefined} Serializable error context for logs.
 */
const serializeError = (error) => {
  if (!error) {
    return undefined
  }

  return {
    name: error.name,
    message: error.message,
    status: error.status,
    url: error.url,
    cmrRequest: error.cmrRequest,
    cmrCause: error.cmrCause,
    stack: error.stack
  }
}

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

  // Process the SQS batch in parallel; each record contains one SNS-delivered keyword event.
  await Promise.all(records.map(async (record) => {
    const messageId = record?.messageId
    let eventType
    let scheme
    let uuid
    let keywordObject

    try {
      // Unwrap the SNS envelope first, then parse the original KMS keyword event payload.
      const { body } = record

      const snsEnvelope = JSON.parse(body || '{}')
      const keywordEvent = snsEnvelope.Message
        ? JSON.parse(snsEnvelope.Message)
        : null

      eventType = keywordEvent?.EventType
      scheme = keywordEvent?.Scheme
      uuid = keywordEvent?.UUID
      keywordObject = getLookupKeywordObject(keywordEvent)

      const keywordEventType = String(eventType || '').toUpperCase()

      logger.info(
        '[consumer] Received keyword event for CMR listener '
        + `messageId=${messageId || 'n/a'} `
        + `eventType=${eventType || 'n/a'} `
        + `scheme=${scheme || 'n/a'} `
        + `uuid=${uuid || 'n/a'} `
        + `keywordObject=${formatKeywordObjectForLog(keywordObject)}`
      )

      if (keywordEvent && LOOKUP_ELIGIBLE_EVENT_TYPES.has(keywordEventType)) {
        // Find every collection that currently references this keyword uuid so we can fan out
        // one metadata-correction request per affected collection.
        const collectionConceptIds = await getCmrCollectionConceptIds({
          scheme,
          uuid,
          keywordObject
        })

        logger.info(
          '[consumer] Found collection concept ids for metadata correction '
          + `scheme=${scheme} `
          + `uuid=${uuid} `
          + `keywordObject=${formatKeywordObjectForLog(keywordObject)} `
          + `count=${collectionConceptIds.length}`
        )

        if (collectionConceptIds.length === 0) {
          logger.info(
            '[consumer] No affected collection concept ids found for keyword event '
            + `scheme=${scheme} `
            + `uuid=${uuid} `
            + `keywordObject=${formatKeywordObjectForLog(keywordObject)}`
          )
        }

        // Publish a collection-scoped correction request for each affected concept id.
        await publishCollectionCorrectionRequests(collectionConceptIds, keywordEvent)
      } else if (keywordEvent) {
        // Only UPDATED and DELETED keyword events trigger collection lookup fanout.
        logger.info(
          '[consumer] Skipping metadata correction concept-id lookup for event type '
          + `eventType=${eventType || 'n/a'} `
          + `scheme=${scheme || 'n/a'} `
          + `uuid=${uuid || 'n/a'} `
          + `keywordObject=${formatKeywordObjectForLog(keywordObject)}`
        )
      }
    } catch (error) {
      // Surface enough keyword-event context to debug the failing record quickly in CloudWatch.
      logger.error('Failed to process keyword event record', {
        messageId: messageId || 'n/a',
        eventType: eventType || 'n/a',
        scheme: scheme || 'n/a',
        uuid: uuid || 'n/a',
        keywordObject: hasMeaningfulKeywordObject(keywordObject) ? keywordObject : 'n/a',
        error: serializeError(error)
      })

      throw error
    }
  }))

  return {
    batchItemFailures: []
  }
}

export default cmrKeywordEventsListener
