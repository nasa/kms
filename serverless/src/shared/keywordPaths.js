/**
 * Shared KMS keyword path and slot semantics.
 *
 * This module is intentionally limited to canonical KMS path behavior:
 * - which schemes use full-path versus short-name lookups
 * - how hierarchical keyword fragments map into slotted KMS paths
 * - how keyword paths are split/joined
 * - how CSV paths are padded for schemes with reserved slots or trailing metadata columns
 *
 * It does not own UMM-C extraction details or DIF10 XML field names. Those remain adapter
 * concerns in their local modules.
 */

export const KEYWORD_PATH_SEPARATOR = ' > '

export const KEYWORD_LOOKUP_FULL_PATH_SCHEMES = Object.freeze([
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

export const KEYWORD_LOOKUP_SHORT_NAME_SCHEMES = Object.freeze([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat',
  'granuledataformat'
])

export const HISTORICAL_CACHE_FULL_PATH_SCHEMES = Object.freeze([
  'sciencekeywords',
  'locations',
  'chronounits',
  'rucontenttype',
  'isotopiccategory',
  'temporalresolutionrange',
  'horizontalresolutionrange'
])

export const HISTORICAL_CACHE_SHORT_NAME_SCHEMES = Object.freeze([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat'
])

export const PUBLISHED_CACHE_FULL_PATH_SCHEMES = Object.freeze([
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

export const PUBLISHED_CACHE_SHORT_NAME_SCHEMES = Object.freeze([
  'providers',
  'platforms',
  'instruments',
  'projects',
  'idnnode',
  'dataformat',
  'granuledataformat'
])

const LOOKUP_FULL_PATH_SCHEME_SET = new Set(KEYWORD_LOOKUP_FULL_PATH_SCHEMES)
const LOOKUP_SHORT_NAME_SCHEME_SET = new Set(KEYWORD_LOOKUP_SHORT_NAME_SCHEMES)
const HISTORICAL_CACHE_FULL_PATH_SCHEME_SET = new Set(HISTORICAL_CACHE_FULL_PATH_SCHEMES)
const HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET = new Set(HISTORICAL_CACHE_SHORT_NAME_SCHEMES)
const PUBLISHED_CACHE_FULL_PATH_SCHEME_SET = new Set(PUBLISHED_CACHE_FULL_PATH_SCHEMES)
const PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET = new Set(PUBLISHED_CACHE_SHORT_NAME_SCHEMES)

const FULL_PATH_VALUE_FIELDS = Object.freeze({
  sciencekeywords: [
    'Category',
    'Topic',
    'Term',
    'VariableLevel1',
    'VariableLevel2',
    'VariableLevel3',
    'DetailedVariable'
  ],
  locations: [
    'Category',
    'Type',
    'Subregion1',
    'Subregion2',
    'Subregion3',
    'DetailedLocation'
  ],
  chronounits: [
    'Eon',
    'Era',
    'Period',
    'Epoch',
    'Age',
    'SubAge'
  ],
  rucontenttype: [
    'URLContentType',
    'Type',
    'Subtype'
  ]
})

export const normalizeKeywordScheme = (scheme) => String(scheme || '').toLowerCase()

export const isLookupFullPathScheme = (scheme) => LOOKUP_FULL_PATH_SCHEME_SET.has(
  normalizeKeywordScheme(scheme)
)

export const isLookupShortNameScheme = (scheme) => LOOKUP_SHORT_NAME_SCHEME_SET.has(
  normalizeKeywordScheme(scheme)
)

export const isHistoricalCacheFullPathScheme = (scheme) => (
  HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

export const isHistoricalCacheShortNameScheme = (scheme) => (
  HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

export const isPublishedCacheFullPathScheme = (scheme) => (
  PUBLISHED_CACHE_FULL_PATH_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

export const isPublishedCacheShortNameScheme = (scheme) => (
  PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

export const getKeywordPathSlotFields = (scheme) => FULL_PATH_VALUE_FIELDS[
  normalizeKeywordScheme(scheme)
]

export const trimKeywordPathSegment = (segment) => {
  if (segment === undefined || segment === null) {
    return ''
  }

  return String(segment).trim()
}

export const splitKeywordPath = (keywordPath = '') => String(keywordPath)
  .split(KEYWORD_PATH_SEPARATOR)
  .map((segment) => trimKeywordPathSegment(segment))

export const joinKeywordPath = (segments = []) => segments
  .map((segment) => trimKeywordPathSegment(segment))
  .join(KEYWORD_PATH_SEPARATOR)

export const flattenKeywordPathValue = (keywordValue) => {
  if (keywordValue === undefined || keywordValue === null) {
    return []
  }

  if (Array.isArray(keywordValue)) {
    return keywordValue.flatMap(flattenKeywordPathValue)
  }

  if (typeof keywordValue === 'object') {
    return Object.values(keywordValue).flatMap(flattenKeywordPathValue)
  }

  return [trimKeywordPathSegment(keywordValue)]
}

/**
 * Builds the canonical KMS keyword path for a scheme from a structured keyword value.
 *
 * Full-path schemes use their canonical slot field order so interior holes are preserved and
 * trailing blanks are padded to the expected slot count. Scalar or unsupported schemes fall back
 * to flattening the value as-is.
 */
export const buildKeywordPathFromValue = ({
  scheme,
  keywordValue
}) => {
  const slotFields = getKeywordPathSlotFields(scheme)
  let segments = []

  if (
    Array.isArray(slotFields)
    && keywordValue
    && typeof keywordValue === 'object'
    && !Array.isArray(keywordValue)
  ) {
    segments = slotFields.map((fieldName) => trimKeywordPathSegment(keywordValue[fieldName]))
  } else {
    segments = flattenKeywordPathValue(keywordValue)
  }

  if (Array.isArray(slotFields)) {
    while (segments.length < slotFields.length) {
      segments.push('')
    }
  }

  return joinKeywordPath(segments)
}

export const extractShortNameLookupValue = (keywordValue) => {
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
 * Applies canonical CSV path padding for schemes that reserve slots for long name, UUID,
 * provider URL, or sparse keyword layouts.
 *
 * This mutates and returns `path` to preserve the historical behavior expected by
 * `buildHierarchicalCsvPaths`.
 */
export const formatKeywordCsvPath = ({
  scheme,
  csvHeadersCount,
  path,
  isLeaf
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  // Keep this logic close to the original formatCsvPath implementation so the
  // production rules stay familiar while living in one shared module.
  if (['platforms', 'instruments', 'projects'].includes(normalizedScheme)) {
    const maxLevel = csvHeadersCount - 2

    if (maxLevel === path.length) {
      return path
    }

    while (maxLevel > path.length) {
      if (!isLeaf) {
        path.push('')
      } else {
        path.splice(path.length - 1, 0, '')
      }
    }

    return path
  }

  if (
    [
      'sciencekeywords',
      'chronounits',
      'locations',
      'discipline',
      'rucontenttype',
      'measurementname'
    ].includes(normalizedScheme)
  ) {
    const maxLevel = csvHeadersCount - 1

    if (maxLevel === path.length) {
      return path
    }

    if (maxLevel > path.length) {
      while (maxLevel > path.length) {
        path.push('')
      }

      return path
    }
  }

  if (normalizedScheme === 'providers') {
    const maxLevel = csvHeadersCount - 3

    if (maxLevel === path.length) {
      return path
    }

    if ((maxLevel > path.length) && !isLeaf) {
      while (maxLevel > path.length) {
        path.push('')
      }

      return path
    }

    if ((maxLevel > path.length) && isLeaf) {
      while (maxLevel > path.length) {
        path.splice(path.length - 1, 0, '')
      }

      return path
    }
  }

  return path
}
