import { v5 as uuidv5 } from 'uuid'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'
import {
  getKeywordPathFromKeywordObject
} from '@/shared/redis-path-store/getKeywordPathFromKeywordObject'

const compactObject = (value) => Object.fromEntries(
  Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
)

const getEventField = (keywordEvent, upperCaseName, lowerCaseName) => (
  keywordEvent?.[upperCaseName] ?? keywordEvent?.[lowerCaseName]
)

const buildFailureAuditId = ({
  messageId,
  outcome,
  publisherMessageId,
  source,
  keywordEvent,
  publishedVersionName
}) => uuidv5(
  [
    'kms:metadata-correction:workflow-failure',
    source,
    publishedVersionName,
    outcome,
    publisherMessageId || messageId || JSON.stringify(keywordEvent)
  ].join(':'),
  uuidv5.URL
)

/**
 * Stores a workflow failure that cannot be associated with a completed collection audit run.
 *
 * @param {Object} params Failure audit values.
 * @param {string} params.source Workflow component that failed.
 * @param {string} params.outcome Stable failure outcome.
 * @param {unknown} params.error Failure value.
 * @param {Object} [params.keywordEvent] Triggering keyword event, when available.
 * @param {string} [params.messageId] Current AWS message id.
 * @param {string} [params.publisherMessageId] Original SNS message id.
 * @param {string} [params.publishedVersionName] Published KMS version.
 * @param {string} [params.timestamp] Processing timestamp override for tests.
 * @returns {Promise<{runId: string, status: string, created: boolean}>} Persistence result.
 */
export const persistMetadataCorrectionWorkflowFailureAuditLog = async ({
  source,
  outcome,
  error,
  keywordEvent,
  messageId,
  publisherMessageId,
  publishedVersionName,
  timestamp
}) => {
  const collection = await getMetadataCorrectionAuditCollection()
  const auditTimestamp = new Date(timestamp || Date.now())
  const runId = buildFailureAuditId({
    keywordEvent,
    messageId,
    outcome,
    publisherMessageId,
    source,
    publishedVersionName
  })
  const eventType = getEventField(keywordEvent, 'EventType', 'eventType')
  const scheme = getEventField(keywordEvent, 'Scheme', 'scheme')
  const uuid = getEventField(keywordEvent, 'UUID', 'uuid')
  const oldKeywordObject = getEventField(keywordEvent, 'OldKeywordObject', 'oldKeywordObject')
  const newKeywordObject = getEventField(keywordEvent, 'NewKeywordObject', 'newKeywordObject')
  const eventTimestamp = getEventField(keywordEvent, 'Timestamp', 'timestamp')
  const correction = keywordEvent && typeof keywordEvent === 'object'
    ? compactObject({
      scheme,
      action: eventType,
      keywordConceptUuid: uuid,
      oldKeywordObject,
      newKeywordObject,
      oldKeywordPath: getKeywordPathFromKeywordObject({
        scheme,
        keywordObject: oldKeywordObject
      }) || '',
      newKeywordPath: getKeywordPathFromKeywordObject({
        scheme,
        keywordObject: newKeywordObject
      }) || ''
    })
    : undefined
  const serializedError = error ? compactObject({
    message: error.message || String(error),
    status: error.status,
    statusText: error.statusText,
    url: error.url,
    cmrRequest: error.cmrRequest,
    cmrResponseBody: error.cmrResponseBody
  }) : undefined
  const result = await collection.updateOne(
    { _id: runId },
    {
      $set: compactObject({
        recordType: 'metadataCorrectionWorkflowFailure',
        publishedVersionName: publishedVersionName
          || getEventField(keywordEvent, 'VersionName', 'publishedVersionName')
          || null,
        source,
        messageId,
        publisherMessageId,
        trigger: keywordEvent && typeof keywordEvent === 'object'
          ? compactObject({
            eventType,
            scheme,
            keywordConceptUuid: uuid,
            timestamp: eventTimestamp
          })
          : undefined,
        corrections: correction ? [correction] : undefined,
        outcome,
        error: serializedError,
        status: 'failed',
        updatedAt: auditTimestamp,
        'timestamps.failedAt': auditTimestamp
      }),
      $setOnInsert: {
        _id: runId,
        runId,
        createdAt: auditTimestamp,
        statusHistory: [{
          status: 'failed',
          timestamp: auditTimestamp,
          outcome,
          ...(serializedError?.message ? { error: serializedError.message } : {})
        }]
      }
    },
    { upsert: true }
  )

  return {
    runId,
    status: 'failed',
    created: result.upsertedCount === 1
  }
}

export default persistMetadataCorrectionWorkflowFailureAuditLog
