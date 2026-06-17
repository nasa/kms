import { getHistoricalConceptByKeyword } from './redis-path-store/getHistoricalConceptByKeyword'
import { getKeywordPathFromKeywordObject } from './redis-path-store/getKeywordPathFromKeywordObject'
import { getPublishedConceptByUuid } from './redis-path-store/getPublishedConceptByUuid'

/**
 * Historical-to-published keyword resolution helper for metadata correction.
 *
 * This module sits between keyword extraction and metadata mutation. After the correction flow
 * has identified an invalid keyword value inside UMM-C, this helper decides how that extracted
 * value should be resolved:
 * - some schemes are resolved through historical full-path lookups
 * - some schemes are resolved through historical short-name lookups
 *
 * Once the historical concept is found, the helper either:
 * - resolves the current published concept path for replacement-style updates
 * - or recognizes that the triggering event is a true delete and returns a delete action with no
 *   replacement path
 *
 * In other words, this is the point where a broken metadata value becomes a concrete correction
 * plan keyed by normalized keyword objects, with optional long-name metadata when the
 * historical/published caches provide it.
 */

/**
 * Determines whether the triggering keyword event should be treated as a true delete for the
 * resolved historical concept.
 *
 * @param {object} params - Delete-match parameters.
 * @param {{ eventType?: string, uuid?: string, scheme?: string }} [params.keywordEvent={}] - Triggering keyword event.
 * @param {string} params.normalizedScheme - Normalized KMS scheme being resolved.
 * @param {string|undefined} params.keywordConceptUuid - Resolved historical concept UUID.
 * @returns {boolean} `true` when the event proves this keyword should be deleted.
 */
const isDeleteMatchForKeyword = ({
  keywordEvent,
  normalizedScheme,
  keywordConceptUuid
}) => (
  keywordEvent?.eventType === 'DELETED'
  && keywordEvent?.uuid
  && keywordEvent.uuid === keywordConceptUuid
  && (
    !keywordEvent?.scheme
    || String(keywordEvent.scheme).toLowerCase() === normalizedScheme
  )
)

/**
 * Resolves the current published keyword concept for a known UUID.
 *
 * @param {object} params - Published lookup parameters.
 * @param {string|undefined} params.keywordConceptUuid - Resolved concept UUID.
 * @param {string} params.normalizedScheme - Normalized KMS scheme namespace.
 * @returns {Promise<{uuid: string, fullPath: string, longName?: string}|undefined>}
 * Current published concept payload when found.
 */
const getCurrentPublishedKeywordConcept = async ({
  keywordConceptUuid,
  normalizedScheme
}) => getPublishedConceptByUuid({
  uuid: keywordConceptUuid,
  scheme: normalizedScheme
})

/**
 * Normalizes a candidate keyword object to the plain-object shape expected by correction logic.
 *
 * @param {unknown} keywordObject Historical or published keyword object candidate.
 * @returns {Record<string, string>} Plain-object keyword payload, or an empty object.
 */
const normalizeKeywordObject = (keywordObject) => (
  keywordObject
  && typeof keywordObject === 'object'
  && !Array.isArray(keywordObject)
    ? keywordObject
    : {}
)

/**
 * Builds the normalized correction descriptor returned to the metadata-correction service.
 *
 * @param {object} params - Correction descriptor fields.
 * @param {string} params.scheme - Normalized keyword scheme.
 * @param {string|undefined} params.keywordConceptUuid - Resolved concept UUID.
 * @param {Record<string, string>|undefined} [params.oldKeywordObject] - Historical keyword object.
 * @param {Record<string, string>|undefined} [params.newKeywordObject] - Current published keyword object.
 * @param {string|undefined} [params.oldLongName] - Historical long name when available.
 * @param {string|undefined} [params.newLongName] - Current published long name when available.
 * @param {'replace'|'delete'|string|undefined} params.action - Correction action.
 * @returns {{
 *   keywordConceptUuid: string,
 *   oldKeywordObject?: Record<string, string>,
 *   newKeywordObject?: Record<string, string>,
 *   action: string,
 *   oldLongName?: string,
 *   newLongName?: string,
 *   oldKeywordPath?: string,
 *   newKeywordPath?: string
 * }|undefined}
 * Normalized correction descriptor, or `undefined` if required fields are missing.
 */
const buildKeywordReference = ({
  scheme,
  keywordConceptUuid,
  oldKeywordObject,
  newKeywordObject,
  oldLongName,
  newLongName,
  action
}) => {
  const normalizedOldKeywordObject = normalizeKeywordObject(oldKeywordObject)
  const normalizedNewKeywordObject = normalizeKeywordObject(newKeywordObject)

  if (
    !keywordConceptUuid
    || !action
    || Object.keys(normalizedOldKeywordObject).length === 0
  ) {
    return undefined
  }

  if (
    action === 'replace'
    && Object.keys(normalizedNewKeywordObject).length === 0
  ) {
    return undefined
  }

  const keywordReference = {
    keywordConceptUuid,
    oldKeywordObject: normalizedOldKeywordObject,
    newKeywordObject: normalizedNewKeywordObject,
    action
  }
  const oldKeywordPath = getKeywordPathFromKeywordObject({
    scheme,
    keywordObject: normalizedOldKeywordObject
  })
  const newKeywordPath = getKeywordPathFromKeywordObject({
    scheme,
    keywordObject: normalizedNewKeywordObject
  })

  if (oldLongName) {
    keywordReference.oldLongName = oldLongName
  }

  if (newLongName) {
    keywordReference.newLongName = newLongName
  }

  if (oldKeywordPath) {
    keywordReference.oldKeywordPath = oldKeywordPath
  }

  if (newKeywordPath) {
    keywordReference.newKeywordPath = newKeywordPath
  }

  return keywordReference
}

/**
 * Normalizes the keyword object attached to a cached concept payload.
 *
 * @param {object|undefined} params.concept - Cached concept payload.
 * @returns {Record<string, string>} Canonical keyword object for the concept.
 */
const getConceptKeywordObject = ({
  concept
}) => (
  concept?.keywordObject && typeof concept.keywordObject === 'object'
    ? concept.keywordObject
    : {}
)

/**
 * Resolves an extracted invalid keyword value into a concrete correction descriptor.
 *
 * After the historical concept is found, the helper either:
 * - returns `action: 'delete'` when the triggering event proves this exact concept was deleted
 * - or looks up the current published concept path by UUID and returns `action: 'replace'`
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.scheme - KMS scheme for the broken keyword.
 * @param {unknown} [params.keywordValue] - Extracted UMM-C keyword fragment used for both
 * full-path and short-name lookups.
 * @param {{ eventType?: string, scheme?: string, uuid?: string }} [params.keywordEvent={}] - Triggering keyword event context.
 * @returns {Promise<{
 *   keywordConceptUuid: string,
 *   oldKeywordObject: Record<string, string>,
 *   newKeywordObject?: Record<string, string>,
 *   action: string,
 *   oldLongName?: string,
 *   newLongName?: string,
 *   oldKeywordPath?: string,
 *   newKeywordPath?: string
 * }|undefined>} Concrete correction descriptor for later delegate application.
 */
export const resolveOldKeywordConceptUuid = async ({
  scheme,
  keywordValue,
  keywordEvent = {}
}) => {
  if (!scheme) {
    return undefined
  }

  if (keywordValue === undefined || keywordValue === null) {
    return undefined
  }

  const normalizedScheme = String(scheme).toLowerCase()
  const historicalConcept = await getHistoricalConceptByKeyword({
    scheme: normalizedScheme,
    keywordValue
  })
  const keywordConceptUuid = historicalConcept?.uuid

  if (!keywordConceptUuid) {
    return undefined
  }

  const isDeleteMatch = isDeleteMatchForKeyword({
    keywordEvent,
    normalizedScheme,
    keywordConceptUuid
  })

  if (isDeleteMatch) {
    // Delete handling is the same for every lookup style: once the UUID matches the delete event,
    // no replacement path is required.
    return buildKeywordReference({
      scheme: normalizedScheme,
      keywordConceptUuid,
      oldKeywordObject: getConceptKeywordObject({
        concept: historicalConcept
      }),
      newKeywordObject: {},
      oldLongName: historicalConcept?.longName,
      action: 'delete'
    })
  }

  // Replacement-style updates reuse the same UUID to find the current published path.
  const currentPublishedConcept = await getCurrentPublishedKeywordConcept({
    keywordConceptUuid,
    normalizedScheme
  })

  return buildKeywordReference({
    scheme: normalizedScheme,
    keywordConceptUuid,
    oldKeywordObject: getConceptKeywordObject({
      concept: historicalConcept
    }),
    newKeywordObject: getConceptKeywordObject({
      concept: currentPublishedConcept
    }),
    oldLongName: historicalConcept?.longName,
    newLongName: currentPublishedConcept?.longName,
    action: 'replace'
  })
}

export default resolveOldKeywordConceptUuid
