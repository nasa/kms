import { v5 as uuidv5 } from 'uuid'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'
import {
  getKeywordPathFromKeywordObject
} from '@/shared/redis-path-store/getKeywordPathFromKeywordObject'

/**
 * Removes undefined properties while retaining meaningful null and empty values.
 *
 * @param {Object} value Source object.
 * @returns {Object} Object without undefined entries.
 */
const compactObject = (value) => Object.fromEntries(
  Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
)

/**
 * Builds the no-op audit id from an AWS message id so retries update the same document.
 *
 * @param {Object} params Identifier inputs.
 * @param {string} [params.messageId] Listener SQS message id.
 * @param {string} [params.publisherMessageId] Original SNS message id.
 * @param {Object} params.keywordEvent Original publisher event.
 * @returns {string} Retry-stable audit UUID.
 */
const buildNoOpAuditId = ({
  messageId,
  publisherMessageId,
  keywordEvent
}) => uuidv5(
  `kms:metadata-correction:no-op:${publisherMessageId || messageId || JSON.stringify(keywordEvent)}`,
  uuidv5.URL
)

/**
 * Stores a publisher event when its CMR lookup returns no collections to evaluate.
 *
 * Existing collection-level audit records cover every collection that is found. This no-op
 * document fills the remaining visibility gap without changing or duplicating that workflow.
 *
 * @example
 * await persistMetadataCorrectionNoOpAuditLog({
 *   keywordEvent: {
 *     EventType: 'UPDATED',
 *     Scheme: 'platforms',
 *     UUID: 'bac2e743-1d02-4868-8bd6-b8b8741e3794',
 *     VersionName: '20.1',
 *     OldKeywordObject: { ShortName: 'GOSAT' },
 *     NewKeywordObject: { ShortName: 'GOSAT - Test1' }
 *   },
 *   publisherMessageId: 'sns-message-1'
 * })
 * // { runId: '<stable UUID>', status: 'checked', created: true }
 *
 * @param {Object} params No-op audit values.
 * @param {Object} params.keywordEvent Original KMS publisher event.
 * @param {string} [params.messageId] Listener SQS message id.
 * @param {string} [params.publisherMessageId] Original SNS message id.
 * @param {string} [params.timestamp] Processing timestamp override for tests.
 * @returns {Promise<{runId: string, status: string, created: boolean}>} Persistence result.
 */
export const persistMetadataCorrectionNoOpAuditLog = async ({
  keywordEvent,
  messageId,
  publisherMessageId,
  timestamp
}) => {
  if (!keywordEvent || typeof keywordEvent !== 'object') {
    throw new Error('Missing keywordEvent for metadata correction no-op audit persistence')
  }

  const collection = await getMetadataCorrectionAuditCollection()
  const auditTimestamp = new Date(timestamp || Date.now())
  const runId = buildNoOpAuditId({
    keywordEvent,
    messageId,
    publisherMessageId
  })
  const scheme = keywordEvent.Scheme
  const oldKeywordObject = keywordEvent.OldKeywordObject
  const newKeywordObject = keywordEvent.NewKeywordObject
  const correction = compactObject({
    scheme,
    action: keywordEvent.EventType,
    keywordConceptUuid: keywordEvent.UUID,
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
  const result = await collection.updateOne(
    { _id: runId },
    {
      $set: compactObject({
        recordType: 'publisherEventNoOp',
        collectionCount: 0,
        publishedVersionName: keywordEvent.VersionName || null,
        source: 'cmrKeywordEventsListener',
        messageId,
        publisherMessageId,
        trigger: compactObject({
          eventType: keywordEvent.EventType,
          scheme,
          keywordConceptUuid: keywordEvent.UUID,
          timestamp: keywordEvent.Timestamp
        }),
        corrections: [correction],
        outcome: 'no-collections-found',
        status: 'checked',
        updatedAt: auditTimestamp,
        'timestamps.checkedAt': auditTimestamp
      }),
      $setOnInsert: {
        _id: runId,
        runId,
        createdAt: auditTimestamp,
        statusHistory: [{
          status: 'checked',
          timestamp: auditTimestamp,
          outcome: 'no-collections-found'
        }]
      }
    },
    { upsert: true }
  )

  return {
    runId,
    status: 'checked',
    created: result.upsertedCount === 1
  }
}

export default persistMetadataCorrectionNoOpAuditLog
