import { buildHistoricalKeywordLookupPath } from './buildHistoricalKeywordLookupPath'
import { getConceptUuidByFullPath } from './getConceptUuidByFullPath'
import { getConceptUuidByShortName } from './getConceptUuidByShortName'
import { getPublishedConceptByUuid } from './getPublishedConceptByUuid'

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
 * plan: `{ keywordConceptUuid, oldKeywordPath, newKeywordPath, action }`, with optional long-name
 * metadata when the historical/published caches provide it.
 */

const FULL_PATH_SCHEMES = new Set([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange',
  'verticalresolutionrange',
  'productlevelid'
])

const SHORT_NAME_SCHEMES = new Set([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat',
  'granuledataformat'
])

const extractShortNameLookupValue = (keywordValue) => {
  if (keywordValue === undefined || keywordValue === null) {
    return ''
  }

  if (typeof keywordValue === 'string' || typeof keywordValue === 'number') {
    return String(keywordValue)
  }

  return typeof keywordValue?.ShortName === 'string'
    ? keywordValue.ShortName
    : ''
}

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
}) => {
  if (!keywordConceptUuid) {
    return undefined
  }

  return getPublishedConceptByUuid({
    uuid: keywordConceptUuid,
    scheme: normalizedScheme
  })
}

/**
 * Builds the normalized correction descriptor returned to the metadata-correction service.
 *
 * @param {object} params - Correction descriptor fields.
 * @param {string|undefined} params.keywordConceptUuid - Resolved concept UUID.
 * @param {string|undefined} params.oldKeywordPath - Historical keyword path.
 * @param {string|undefined} params.newKeywordPath - Current published keyword path.
 * @param {string|undefined} [params.oldLongName] - Historical long name when available.
 * @param {string|undefined} [params.newLongName] - Current published long name when available.
 * @param {'replace'|'delete'|string|undefined} params.action - Correction action.
 * @returns {{
 *   keywordConceptUuid: string,
 *   oldKeywordPath: string,
 *   newKeywordPath: string|undefined,
 *   action: string,
 *   oldLongName?: string,
 *   newLongName?: string
 * }|undefined}
 * Normalized correction descriptor, or `undefined` if required fields are missing.
 */
const buildKeywordReference = ({
  keywordConceptUuid,
  oldKeywordPath,
  newKeywordPath,
  oldLongName,
  newLongName,
  action
}) => {
  if (!keywordConceptUuid || !oldKeywordPath || !action) {
    return undefined
  }

  if (action === 'replace' && !newKeywordPath) {
    return undefined
  }

  const keywordReference = {
    keywordConceptUuid,
    oldKeywordPath,
    newKeywordPath,
    action
  }

  if (oldLongName) {
    keywordReference.oldLongName = oldLongName
  }

  if (newLongName) {
    keywordReference.newLongName = newLongName
  }

  return keywordReference
}

/**
 * Resolves an extracted invalid keyword value into a concrete correction descriptor.
 *
 * The helper first chooses the appropriate historical cache lookup strategy based on scheme:
 * - full-path lookup for schemes represented as hierarchical paths
 * - short-name lookup for schemes represented by short-name values
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
 *   oldKeywordPath: string,
 *   newKeywordPath: string,
 *   action: string,
 *   oldLongName?: string,
 *   newLongName?: string
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

  const normalizedScheme = scheme.toLowerCase()

  if (FULL_PATH_SCHEMES.has(normalizedScheme)) {
    if (keywordValue === undefined) {
      return undefined
    }

    // Resolve schemes whose historical cache key is based on a hierarchical full path.
    const historicalConcept = await getConceptUuidByFullPath({
      fullPath: buildHistoricalKeywordLookupPath({
        keywordValue,
        scheme: normalizedScheme
      }),
      scheme: normalizedScheme
    })
    const keywordConceptUuid = historicalConcept?.uuid
    const isDeleteMatch = isDeleteMatchForKeyword({
      keywordEvent,
      normalizedScheme,
      keywordConceptUuid
    })

    if (isDeleteMatch) {
      // True delete events do not need a replacement path; removing the historical concept match is enough.
      return buildKeywordReference({
        keywordConceptUuid,
        oldKeywordPath: historicalConcept?.fullPath,
        newKeywordPath: '',
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
      keywordConceptUuid,
      oldKeywordPath: historicalConcept?.fullPath,
      newKeywordPath: currentPublishedConcept?.fullPath,
      oldLongName: historicalConcept?.longName,
      newLongName: currentPublishedConcept?.longName,
      action: 'replace'
    })
  }

  if (SHORT_NAME_SCHEMES.has(normalizedScheme)) {
    // Resolve schemes whose historical cache key is based on a short-name lookup.
    const lookupValue = extractShortNameLookupValue(keywordValue)

    if (!lookupValue) {
      return undefined
    }

    const historicalConcept = await getConceptUuidByShortName({
      shortName: lookupValue,
      scheme: normalizedScheme
    })
    const keywordConceptUuid = historicalConcept?.uuid
    const isDeleteMatch = isDeleteMatchForKeyword({
      keywordEvent,
      normalizedScheme,
      keywordConceptUuid
    })

    if (isDeleteMatch) {
      // Delete handling is the same here: once the UUID matches the delete event, no replacement path is required.
      return buildKeywordReference({
        keywordConceptUuid,
        oldKeywordPath: historicalConcept?.fullPath,
        newKeywordPath: '',
        oldLongName: historicalConcept?.longName,
        action: 'delete'
      })
    }

    // Otherwise, resolve the current published concept path for a replace-style correction.
    const currentPublishedConcept = await getCurrentPublishedKeywordConcept({
      keywordConceptUuid,
      normalizedScheme
    })

    return buildKeywordReference({
      keywordConceptUuid,
      oldKeywordPath: historicalConcept?.fullPath,
      newKeywordPath: currentPublishedConcept?.fullPath,
      oldLongName: historicalConcept?.longName,
      newLongName: currentPublishedConcept?.longName,
      action: 'replace'
    })
  }

  // Unsupported schemes are intentionally ignored until the correction pipeline adds rules for them.
  return undefined
}

export default resolveOldKeywordConceptUuid
