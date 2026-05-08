import { getConceptUuidByFullPath } from './getConceptUuidByFullPath'
import { getConceptUuidByShortName } from './getConceptUuidByShortName'
import { getPublishedConceptByUuid } from './getPublishedConceptByUuid'

const OLD_KEYWORD_PLACEHOLDER_PREFIX = '[resolve old keyword from UMM-C value: '
const INTERNAL_PATH_SEPARATOR = '|'
const HISTORICAL_CACHE_PATH_SEPARATOR = ' > '

/*
 * Lookup routing reference
 *
 * After extractKeywordValidationFailures builds `oldKeyword`, this file decides whether
 * the extracted value should be treated like:
 * - `/concept_uuid/full_path/{full_path}`
 * - `/concept_uuid/short_name/{shortname}`
 *
 * Current routing:
 * - full_path: sciencekeywords, locations, chronounits, rucontenttype,
 *   isotopiccategory, temporalresolutionrange, horizontalresolutionrange,
 *   verticalresolutionrange, ProductLevelId
 * - short_name: providers, platforms, instruments, projects, idnnode,
 *   DataFormat, GranuleDataFormat
 *
 * KMS-664 now provides the Redis-backed historical lookups behind these two routes.
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

// Convert the current placeholder string back into the raw lookup value expected by the stub.
const extractLookupValue = (oldKeyword) => {
  if (oldKeyword.startsWith(OLD_KEYWORD_PLACEHOLDER_PREFIX) && oldKeyword.endsWith(']')) {
    return oldKeyword.slice(OLD_KEYWORD_PLACEHOLDER_PREFIX.length, -1)
  }

  return oldKeyword
}

const toHistoricalCacheFullPath = (keywordPath) => keywordPath
  .split(INTERNAL_PATH_SEPARATOR)
  .join(HISTORICAL_CACHE_PATH_SEPARATOR)

const isDeleteMatchForKeyword = ({
  keywordEvent = {},
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

const getCurrentKeywordPath = async ({
  keywordConceptUuid,
  normalizedScheme
}) => {
  if (!keywordConceptUuid) {
    return undefined
  }

  const currentPublishedConcept = await getPublishedConceptByUuid({
    uuid: keywordConceptUuid,
    scheme: normalizedScheme
  })

  return currentPublishedConcept?.fullPath
}

const buildKeywordReference = ({
  keywordConceptUuid,
  oldKeywordPath,
  newKeywordPath,
  action
}) => {
  if (!keywordConceptUuid || !oldKeywordPath || !action) {
    return undefined
  }

  if (action === 'replace' && !newKeywordPath) {
    return undefined
  }

  return {
    keywordConceptUuid,
    oldKeywordPath,
    newKeywordPath,
    action
  }
}

/**
 * Routes extracted UMM-C keyword values to the correct historical lookup and then resolves
 * the current published keyword path by UUID.
 *
 * KMS-675 uses this shared helper so the metadata-correction flow already has a single
 * handoff point from extracted broken UMM-C values to historical/current keyword references.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.scheme - KMS scheme for the broken keyword.
 * @param {string} params.oldKeyword - Current placeholder value extracted from UMM-C.
 * @returns {Promise<{
 *   keywordConceptUuid: string,
 *   oldKeywordPath: string,
 *   newKeywordPath: string
 * }|undefined>} Placeholder keyword reference for later delegate replacement.
 */
export const resolveOldKeywordConceptUuid = async ({
  scheme,
  oldKeyword,
  keywordEvent = {}
}) => {
  if (!scheme || !oldKeyword) {
    return undefined
  }

  const normalizedScheme = scheme.toLowerCase()
  const lookupValue = extractLookupValue(oldKeyword)

  if (!lookupValue) {
    return undefined
  }

  if (FULL_PATH_SCHEMES.has(normalizedScheme)) {
    const historicalConcept = await getConceptUuidByFullPath({
      fullPath: toHistoricalCacheFullPath(lookupValue),
      scheme: normalizedScheme
    })
    const keywordConceptUuid = historicalConcept?.uuid
    const isDeleteMatch = isDeleteMatchForKeyword({
      keywordEvent,
      normalizedScheme,
      keywordConceptUuid
    })

    if (isDeleteMatch) {
      return buildKeywordReference({
        keywordConceptUuid,
        oldKeywordPath: historicalConcept?.fullPath,
        newKeywordPath: '',
        action: 'delete'
      })
    }

    const newKeywordPath = await getCurrentKeywordPath({
      keywordConceptUuid,
      normalizedScheme
    })

    return buildKeywordReference({
      keywordConceptUuid,
      oldKeywordPath: historicalConcept?.fullPath,
      newKeywordPath,
      action: 'replace'
    })
  }

  if (SHORT_NAME_SCHEMES.has(normalizedScheme)) {
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
      return buildKeywordReference({
        keywordConceptUuid,
        oldKeywordPath: historicalConcept?.fullPath,
        newKeywordPath: '',
        action: 'delete'
      })
    }

    const newKeywordPath = await getCurrentKeywordPath({
      keywordConceptUuid,
      normalizedScheme
    })

    return buildKeywordReference({
      keywordConceptUuid,
      oldKeywordPath: historicalConcept?.fullPath,
      newKeywordPath,
      action: 'replace'
    })
  }

  return undefined
}

export default resolveOldKeywordConceptUuid
