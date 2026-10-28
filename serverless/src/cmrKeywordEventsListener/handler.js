import { filterEnabledProviderCollectionConceptIds } from '@/shared/cmrWritebackProviders'
import { formatKeywordObjectForLog } from '@/shared/formatKeywordObjectForLog'
import { getCmrCollectionConceptIds } from '@/shared/getCmrCollectionConceptIds'
import { hasMeaningfulKeywordObject } from '@/shared/hasMeaningfulKeywordObject'
import { logger } from '@/shared/logger'
import persistAuditLog from '@/shared/persistMetadataCorrectionAuditLog'
import {
  persistMetadataCorrectionNoOpAuditLog
} from '@/shared/persistMetadataCorrectionNoOpAuditLog'
import {
  persistMetadataCorrectionWorkflowFailureAuditLog
} from '@/shared/persistMetadataCorrectionWorkflowFailureAuditLog'
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
    Timestamp: timestamp,
    VersionName: versionName
  } = keywordEvent

  return {
    source: 'cmrKeywordEventsListener',
    collectionConceptId,
    publishedVersionName: versionName,
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
 * Publishes one collection-scoped correction request per impacted collection concept id.
 *
 * @param {string[]} collectionConceptIds - Affected collection concept ids returned by CMR.
 * @param {Record<string, unknown>} keywordEvent - Raw parsed KMS keyword event.
 * @param {string} [messageId] - Source SQS message id used to correlate publish failures.
 * @returns {Promise<void>} Resolves once all publish calls complete.
 */
const publishCollectionCorrectionRequests = async (
  collectionConceptIds,
  keywordEvent,
  messageId
) => {
  await Promise.all(collectionConceptIds.map(async (collectionConceptId) => {
    const metadataCorrectionRequest = buildMetadataCorrectionRequest(
      collectionConceptId,
      keywordEvent
    )

    try {
      const publishResult = await publishMetadataCorrectionRequest(metadataCorrectionRequest)

      logger.info(
        '[consumer] Published metadata correction request '
        + `collectionConceptId=${metadataCorrectionRequest.collectionConceptId} `
        + `uuid=${metadataCorrectionRequest.keywordEvent.uuid || 'n/a'} `
        + `eventTimestamp=${metadataCorrectionRequest.keywordEvent.timestamp || 'n/a'} `
        + `messageId=${publishResult.messageId || 'n/a'} `
        + `topicArn=${publishResult.topicArn || 'n/a'}`
      )
    } catch (error) {
      logger.error('[consumer] Failed to publish metadata correction request', {
        collectionConceptId,
        messageId: messageId || 'n/a',
        eventType: metadataCorrectionRequest.keywordEvent.eventType || 'n/a',
        scheme: metadataCorrectionRequest.keywordEvent.scheme || 'n/a',
        uuid: metadataCorrectionRequest.keywordEvent.uuid || 'n/a',
        error: serializeError(error)
      })

      // A record replay would republish collection requests that succeeded before this failure.
      // Audit this collection once and allow the remaining collection requests to continue.
      try {
        await persistAuditLog({
          status: 'failed',
          collectionConceptId,
          publishedVersionName: metadataCorrectionRequest.publishedVersionName,
          source: 'cmrKeywordEventsListener',
          messageId,
          keywordEvent: metadataCorrectionRequest.keywordEvent,
          outcome: 'correction-request-publish-failed',
          error
        })
      } catch (auditError) {
        logger.error('[consumer] Failed to persist correction request publish failure', {
          collectionConceptId,
          messageId: messageId || 'n/a',
          error: serializeError(auditError)
        })
      }
    }
  }))
}

const LOOKUP_ELIGIBLE_EVENT_TYPES = new Set([
  'UPDATED',
  'DELETED'
])

/**
 * Logs a debug line for a collection concept id dropped because its provider is not enabled.
 *
 * @param {{ collectionConceptId: string, providerId: string }} skippedEntry Skipped concept id.
 */
const logSkippedProvider = ({ collectionConceptId, providerId }) => {
  logger.debug(
    '[consumer] Skipping metadata correction request for provider not enabled '
    + `collectionConceptId=${collectionConceptId} providerId=${providerId || 'n/a'}`
  )
}

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
    let keywordEvent
    let publisherMessageId

    try {
      // Unwrap the SNS envelope first, then parse the original KMS keyword event payload.
      const { body } = record

      const snsEnvelope = JSON.parse(body || '{}')
      publisherMessageId = snsEnvelope.MessageId
      keywordEvent = snsEnvelope.Message
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
          await persistMetadataCorrectionNoOpAuditLog({
            keywordEvent,
            messageId,
            publisherMessageId
          })

          logger.info(
            '[consumer] No affected collection concept ids found for keyword event '
            + `scheme=${scheme} `
            + `uuid=${uuid} `
            + `keywordObject=${formatKeywordObjectForLog(keywordObject)}`
          )
        }

        // Drop collections whose provider isn't enabled for the fixer service before queuing
        // so that extra processing is not done for those records
        const { eligibleCollectionConceptIds } = filterEnabledProviderCollectionConceptIds(
          collectionConceptIds,
          logSkippedProvider
        )

        // Publish a collection-scoped correction request for each eligible concept id.
        await publishCollectionCorrectionRequests(
          eligibleCollectionConceptIds,
          keywordEvent,
          messageId
        )
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

      // Previously, rethrowing failed the invocation so SQS could retry temporary failures.
      // A retry restarted the entire fanout, duplicating collection requests already published.
      // Audit the failure and allow the handler to succeed so SQS acknowledges the message;
      // failed work requires manual follow-up instead of automatically replaying successful work.
      try {
        await persistMetadataCorrectionWorkflowFailureAuditLog({
          source: 'cmrKeywordEventsListener',
          outcome: 'keyword-event-processing-failed',
          error,
          keywordEvent,
          messageId,
          publisherMessageId
        })
      } catch (auditError) {
        logger.error('Failed to persist keyword event processing failure', {
          messageId: messageId || 'n/a',
          error: serializeError(auditError)
        })
      }
    }
  }))

  return {
    batchItemFailures: []
  }
}

export default cmrKeywordEventsListener
