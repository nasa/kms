import { v4 as uuidv4 } from 'uuid'

import { getMetadataCorrectionAuditCollection } from '@/shared/documentDbClient'
import {
  getKeywordPathFromKeywordObject
} from '@/shared/redis-path-store/getKeywordPathFromKeywordObject'

export const METADATA_CORRECTION_AUDIT_STATUSES = Object.freeze([
  'checked',
  'pending',
  'applied',
  'failed'
])

const TERMINAL_STATUS = 'applied'
const STATUS_ORDER = Object.freeze({
  checked: 0,
  pending: 1,
  failed: 2,
  applied: 3
})

/**
 * Removes only undefined values so meaningful `null`, false, and empty-string values are retained.
 *
 * @example
 * compactObject({ status: 'checked', error: undefined, outcome: null })
 * // { status: 'checked', outcome: null }
 *
 * @param {Object} value Source object.
 * @returns {Object} Object without undefined entries.
 */
const compactObject = (value) => Object.fromEntries(
  Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
)

/**
 * Builds a link to the latest CMR record for an audited collection.
 *
 * @example
 * // With CMR_BASE_URL=https://cmr.earthdata.nasa.gov/
 * buildCmrCollectionUri('C123-PROV')
 * // 'https://cmr.earthdata.nasa.gov/search/concepts/C123-PROV'
 *
 * @param {string} collectionConceptId CMR collection concept id.
 * @returns {string|undefined} CMR concept URI, or undefined when CMR is not configured.
 */
const buildCmrCollectionUri = (collectionConceptId) => {
  const cmrBaseUrl = String(process.env.CMR_BASE_URL || '').trim().replace(/\/+$/, '')

  if (!cmrBaseUrl) return undefined

  return `${cmrBaseUrl}/search/concepts/${encodeURIComponent(collectionConceptId)}`
}

/**
 * Builds the readable CSV-shaped keyword path stored alongside a correction.
 *
 * @example
 * buildAuditKeywordPath({
 *   scheme: 'platforms',
 *   keywordObject: {
 *     Basis: 'Platforms',
 *     Category: 'Space-based Platforms',
 *     SubCategory: 'Earth Observation Satellites',
 *     ShortName: 'GOSAT'
 *   }
 * })
 * // 'Platforms > Space-based Platforms > Earth Observation Satellites > GOSAT'
 *
 * @param {Object} params Path inputs.
 * @param {string} params.scheme Keyword scheme.
 * @param {Object} params.keywordObject CSV-shaped keyword object.
 * @returns {string} Human-readable keyword path, or an empty string when unavailable.
 */
const buildAuditKeywordPath = ({
  scheme,
  keywordObject
}) => getKeywordPathFromKeywordObject({
  scheme,
  keywordObject
}) || ''

/**
 * Preserves each correction and adds readable old/new paths for filtering and display.
 *
 * @example
 * normalizeCorrections([{
 *   scheme: 'dataformat',
 *   oldKeywordObject: { ShortName: 'NetCDF' },
 *   newKeywordObject: { ShortName: 'NetCDF-4' }
 * }])
 * // [{ ..., oldKeywordPath: 'NetCDF', newKeywordPath: 'NetCDF-4' }]
 *
 * @param {Array<Object>} corrections Resolved correction objects.
 * @returns {Array<Object>} Corrections enriched with audit paths.
 */
const normalizeCorrections = (corrections) => corrections.map((correction) => compactObject({
  ...correction,
  oldKeywordPath: buildAuditKeywordPath({
    scheme: correction.scheme,
    keywordObject: correction.oldKeywordObject
  }),
  newKeywordPath: buildAuditKeywordPath({
    scheme: correction.scheme,
    keywordObject: correction.newKeywordObject
  })
}))

/**
 * Maps a lifecycle status to its timestamp field in the audit document.
 *
 * @example
 * buildStatusTimestampField('pending') // 'timestamps.pendingAt'
 *
 * @param {string} status Audit lifecycle status.
 * @returns {string} Dot-notation MongoDB field name.
 */
const buildStatusTimestampField = (status) => `timestamps.${status}At`

/**
 * Converts correction-run inputs into the stable fields stored on one audit document.
 *
 * Error instances are reduced to serializable diagnostic fields, and keyword events are reduced
 * to the trigger fields needed for filtering and traceability.
 *
 * @example
 * buildAuditPatch({
 *   collectionConceptId: 'C123-PROV',
 *   keywordEvent: { eventType: 'UPDATED', scheme: 'platforms', uuid: 'platform-uuid' }
 * })
 * // {
 * //   collectionConceptId: 'C123-PROV',
 * //   trigger: { eventType: 'UPDATED', scheme: 'platforms', keywordConceptUuid: 'platform-uuid' }
 * // }
 *
 * @param {Object} auditFields Correction-run audit values.
 * @returns {Object} Serializable partial audit document for `$set`.
 */
const buildAuditPatch = ({
  collectionConceptId,
  corrections,
  delegateName,
  error,
  keywordEvent,
  keywordValidationFailures,
  messageId,
  nativeFormat,
  outcome,
  priorRevisionId,
  providerId,
  publishedVersionName,
  resultingRevisionId,
  source
}) => compactObject({
  collectionConceptId,
  collectionUri: buildCmrCollectionUri(collectionConceptId),
  providerId,
  publishedVersionName: publishedVersionName || null,
  nativeFormat,
  delegateName,
  source,
  messageId,
  trigger: keywordEvent && Object.keys(keywordEvent).length > 0
    ? compactObject({
      eventType: keywordEvent.eventType,
      scheme: keywordEvent.scheme,
      keywordConceptUuid: keywordEvent.uuid,
      timestamp: keywordEvent.timestamp
    })
    : undefined,
  corrections: Array.isArray(corrections)
    ? normalizeCorrections(corrections)
    : undefined,
  keywordValidationFailures: Array.isArray(keywordValidationFailures)
    ? keywordValidationFailures
    : undefined,
  keywordValidationFailureCount: Array.isArray(keywordValidationFailures)
    ? keywordValidationFailures.length
    : undefined,
  outcome,
  error: error ? compactObject({
    message: error.message || String(error),
    status: error.status,
    statusText: error.statusText,
    url: error.url,
    cmrRequest: error.cmrRequest,
    cmrResponseBody: error.cmrResponseBody
  }) : undefined,
  priorRevisionId,
  resultingRevisionId
})

/**
 * Creates or updates the single DocumentDB audit document for a correction run.
 *
 * Repeated lifecycle calls use the same `runId`, update the current status, and append a status
 * history entry only when the status changes. An applied run cannot be regressed by an SQS retry.
 *
 * @param {Object} params Audit run fields.
 * @param {string} [params.runId] Stable run identifier. Generated when omitted.
 * @param {'checked'|'pending'|'applied'|'failed'} [params.status='checked'] Lifecycle status.
 * @param {string} params.collectionConceptId CMR collection concept id.
 * @param {string} [params.timestamp] ISO timestamp override for tests.
 * @returns {Promise<{runId: string, status: string, created: boolean}>} Persistence summary.
 *
 * @example
 * await persistMetadataCorrectionAuditLog({
 *   runId: 'run-1',
 *   collectionConceptId: 'C123-PROV',
 *   priorRevisionId: 7,
 *   status: 'pending'
 * })
 * // { runId: 'run-1', status: 'pending', created: true }
 */
export const persistMetadataCorrectionAuditLog = async ({
  runId = uuidv4(),
  status = 'checked',
  timestamp,
  ...auditFields
}) => {
  if (!auditFields.collectionConceptId) {
    throw new Error('Missing collectionConceptId for metadata correction audit persistence')
  }

  if (!METADATA_CORRECTION_AUDIT_STATUSES.includes(status)) {
    throw new Error(`Invalid metadata correction audit status: ${status}`)
  }

  const collection = await getMetadataCorrectionAuditCollection()
  const auditTimestamp = new Date(timestamp || Date.now())
  const existingDocument = await collection.findOne(
    { _id: runId },
    { projection: { status: 1 } }
  )

  if (existingDocument?.status === TERMINAL_STATUS && status !== TERMINAL_STATUS) {
    return {
      runId,
      status: existingDocument.status,
      created: false
    }
  }

  const effectiveStatus = existingDocument?.status !== 'failed'
    && STATUS_ORDER[existingDocument?.status] > STATUS_ORDER[status]
    ? existingDocument.status
    : status
  const auditPatch = buildAuditPatch(auditFields)
  const statusChanged = existingDocument?.status !== effectiveStatus
  const setFields = {
    ...auditPatch,
    status: effectiveStatus,
    updatedAt: auditTimestamp
  }

  if (statusChanged) {
    setFields[buildStatusTimestampField(effectiveStatus)] = auditTimestamp
  }

  const update = {
    $set: setFields,
    $setOnInsert: {
      _id: runId,
      runId,
      createdAt: auditTimestamp
    }
  }

  if (statusChanged) {
    update.$push = {
      statusHistory: {
        status: effectiveStatus,
        timestamp: auditTimestamp,
        ...(auditFields.outcome ? { outcome: auditFields.outcome } : {}),
        ...(auditFields.error
          ? { error: auditFields.error.message || String(auditFields.error) }
          : {})
      }
    }
  }

  if (effectiveStatus !== 'failed' && !auditFields.error) {
    update.$unset = { error: '' }
  }

  await collection.updateOne(
    { _id: runId },
    update,
    { upsert: true }
  )

  return {
    runId,
    status: effectiveStatus,
    created: !existingDocument
  }
}

export default persistMetadataCorrectionAuditLog
