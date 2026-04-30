import { getConceptUuidByFullPath } from './getConceptUuidByFullPath'
import { getConceptUuidByShortName } from './getConceptUuidByShortName'

const OLD_KEYWORD_PLACEHOLDER_PREFIX = '[resolve old keyword from UMM-C value: '

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
 * KMS-664 is expected to replace the stub helpers behind these two routes.
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
  'ProductLevelId'
])

const SHORT_NAME_SCHEMES = new Set([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'DataFormat',
  'GranuleDataFormat'
])

// Convert the current placeholder string back into the raw lookup value expected by the stub.
const extractLookupValue = (oldKeyword) => {
  if (oldKeyword.startsWith(OLD_KEYWORD_PLACEHOLDER_PREFIX) && oldKeyword.endsWith(']')) {
    return oldKeyword.slice(OLD_KEYWORD_PLACEHOLDER_PREFIX.length, -1)
  }

  return oldKeyword
}

// Keep the old and new keyword paths identical until KMS-664 adds current-path lookup by UUID.
const buildKeywordReference = ({
  keywordConceptUuid,
  keywordPath
}) => ({
  keywordConceptUuid,
  oldKeywordPath: keywordPath,
  newKeywordPath: keywordPath
})

/**
 * Routes extracted UMM-C keyword values to the correct concept-uuid lookup stub.
 *
 * KMS-664 is expected to replace these stubs with real KMS UUID lookup APIs. KMS-675 uses
 * this shared helper so the metadata-correction flow already has a single handoff point.
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
  oldKeyword
}) => {
  if (!scheme || !oldKeyword) {
    return undefined
  }

  const lookupValue = extractLookupValue(oldKeyword)

  if (!lookupValue) {
    return undefined
  }

  if (FULL_PATH_SCHEMES.has(scheme)) {
    return buildKeywordReference({
      keywordConceptUuid: await getConceptUuidByFullPath({
        fullPath: lookupValue
      }),
      keywordPath: lookupValue
    })
  }

  if (SHORT_NAME_SCHEMES.has(scheme)) {
    return buildKeywordReference({
      keywordConceptUuid: await getConceptUuidByShortName({
        shortName: lookupValue
      }),
      keywordPath: lookupValue
    })
  }

  return undefined
}

export default resolveOldKeywordConceptUuid
