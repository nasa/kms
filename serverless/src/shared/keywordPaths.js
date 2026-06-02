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

/**
 * KMS schemes are treated case-insensitively throughout cache and correction flows.
 *
 * @example
 * normalizeKeywordScheme('ScienceKeywords')
 * // 'sciencekeywords'
 */
export const normalizeKeywordScheme = (scheme) => String(scheme || '').toLowerCase()

/**
 * True when a scheme resolves against a canonical full-path cache key.
 *
 * @example
 * isLookupFullPathScheme('sciencekeywords')
 * // true
 */
export const isLookupFullPathScheme = (scheme) => LOOKUP_FULL_PATH_SCHEME_SET.has(
  normalizeKeywordScheme(scheme)
)

/**
 * True when a scheme resolves against a short-name cache key instead of a full path.
 *
 * @example
 * isLookupShortNameScheme('platforms')
 * // true
 */
export const isLookupShortNameScheme = (scheme) => LOOKUP_SHORT_NAME_SCHEME_SET.has(
  normalizeKeywordScheme(scheme)
)

/**
 * True when the historical cache stores full-path entries for the scheme.
 *
 * @example
 * isHistoricalCacheFullPathScheme('rucontenttype')
 * // true
 */
export const isHistoricalCacheFullPathScheme = (scheme) => (
  HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

/**
 * True when the historical cache stores short-name entries for the scheme.
 *
 * @example
 * isHistoricalCacheShortNameScheme('providers')
 * // true
 */
export const isHistoricalCacheShortNameScheme = (scheme) => (
  HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

/**
 * True when the published cache stores full-path entries for the scheme.
 *
 * @example
 * isPublishedCacheFullPathScheme('productlevelid')
 * // true
 */
export const isPublishedCacheFullPathScheme = (scheme) => (
  PUBLISHED_CACHE_FULL_PATH_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

/**
 * True when the published cache stores short-name entries for the scheme.
 *
 * @example
 * isPublishedCacheShortNameScheme('granuledataformat')
 * // true
 */
export const isPublishedCacheShortNameScheme = (scheme) => (
  PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET.has(normalizeKeywordScheme(scheme))
)

/**
 * Returns the canonical slot order for schemes whose lookup path preserves named positions.
 *
 * @example
 * getKeywordPathSlotFields('rucontenttype')
 * // ['URLContentType', 'Type', 'Subtype']
 */
export const getKeywordPathSlotFields = (scheme) => FULL_PATH_VALUE_FIELDS[
  normalizeKeywordScheme(scheme)
]

/**
 * Normalizes all keyword path segments to trimmed strings, treating missing values as blanks.
 *
 * @example
 * trimKeywordPathSegment('  SNOW/ICE  ')
 * // 'SNOW/ICE'
 */
export const trimKeywordPathSegment = (segment) => {
  if (segment === undefined || segment === null) {
    return ''
  }

  return String(segment).trim()
}

/**
 * Splits a canonical KMS path into trimmed segments while preserving intentional blanks.
 *
 * @example
 * splitKeywordPath('EARTH SCIENCE >  > SNOW/ICE')
 * // ['EARTH SCIENCE', '', 'SNOW/ICE']
 */
export const splitKeywordPath = (keywordPath = '') => String(keywordPath)
  .split('>')
  .map((segment) => trimKeywordPathSegment(segment))

/**
 * Joins ordered path segments back into the standard KMS path separator form.
 *
 * @example
 * joinKeywordPath(['EARTH SCIENCE', '', 'SNOW/ICE'])
 * // 'EARTH SCIENCE >  > SNOW/ICE'
 */
export const joinKeywordPath = (segments = []) => segments
  .map((segment) => trimKeywordPathSegment(segment))
  .join(KEYWORD_PATH_SEPARATOR)

/**
 * Builds a slotted keyword object from ordered segments, padding trailing holes as needed.
 *
 * @example
 * buildKeywordPathObjectFromSegments({
 *   scheme: 'sciencekeywords',
 *   segments: ['EARTH SCIENCE', 'CRYOSPHERE', '', 'SNOW/ICE']
 * })
 * // {
 * //   Category: 'EARTH SCIENCE',
 * //   Topic: 'CRYOSPHERE',
 * //   Term: '',
 * //   VariableLevel1: 'SNOW/ICE',
 * //   VariableLevel2: '',
 * //   VariableLevel3: '',
 * //   DetailedVariable: ''
 * // }
 */
const buildKeywordPathObjectFromSegments = ({
  scheme,
  segments = []
}) => {
  const slotFields = getKeywordPathSlotFields(scheme)

  if (!Array.isArray(slotFields)) {
    return {}
  }

  const normalizedSegments = segments.map((segment) => trimKeywordPathSegment(segment))
  const paddedSegments = normalizedSegments.slice()

  while (paddedSegments.length < slotFields.length) {
    paddedSegments.push('')
  }

  return slotFields.reduce((keywordPathObject, fieldName, index) => ({
    ...keywordPathObject,
    [fieldName]: paddedSegments[index] || ''
  }), {})
}

/**
 * Flattens nested keyword fragments into a simple ordered list of scalar path values.
 *
 * @example
 * flattenKeywordPathValue({
 *   Category: 'EARTH SCIENCE',
 *   Topic: 'CRYOSPHERE',
 *   VariableLevel1: 'SNOW/ICE'
 * })
 * // ['EARTH SCIENCE', 'CRYOSPHERE', 'SNOW/ICE']
 */
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
 * Builds a canonical keyword object from an extracted UMM/native keyword value.
 *
 * @param {object} params - Conversion parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {unknown} params.keywordValue - Extracted keyword fragment.
 * @returns {Record<string, string>} Slotted keyword object for full-path schemes.
 *
 * @example
 * buildKeywordPathObjectFromValue({
 *   scheme: 'sciencekeywords',
 *   keywordValue: {
 *     Category: 'EARTH SCIENCE',
 *     Topic: 'CRYOSPHERE',
 *     VariableLevel1: 'SNOW/ICE'
 *   }
 * })
 * // {
 * //   Category: 'EARTH SCIENCE',
 * //   Topic: 'CRYOSPHERE',
 * //   Term: '',
 * //   VariableLevel1: 'SNOW/ICE',
 * //   VariableLevel2: '',
 * //   VariableLevel3: '',
 * //   DetailedVariable: ''
 * // }
 */
export const buildKeywordPathObjectFromValue = ({
  scheme,
  keywordValue
}) => {
  const slotFields = getKeywordPathSlotFields(scheme)

  if (!Array.isArray(slotFields)) {
    return {}
  }

  if (keywordValue && typeof keywordValue === 'object' && !Array.isArray(keywordValue)) {
    return buildKeywordPathObjectFromSegments({
      scheme,
      segments: slotFields.map((fieldName) => keywordValue[fieldName])
    })
  }

  return buildKeywordPathObjectFromSegments({
    scheme,
    segments: flattenKeywordPathValue(keywordValue)
  })
}

/**
 * Rebuilds a canonical keyword object from an already-joined KMS path string.
 *
 * @param {object} params - Conversion parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {string} params.keywordPath - Canonical KMS path string.
 * @returns {Record<string, string>} Slotted keyword object for the path.
 *
 * @example
 * buildKeywordPathObjectFromPath({
 *   scheme: 'rucontenttype',
 *   keywordPath: 'CollectionURL > PROJECT HOME PAGE > '
 * })
 * // {
 * //   URLContentType: 'CollectionURL',
 * //   Type: 'PROJECT HOME PAGE',
 * //   Subtype: ''
 * // }
 */
export const buildKeywordPathObjectFromPath = ({
  scheme,
  keywordPath
}) => buildKeywordPathObjectFromSegments({
  scheme,
  segments: splitKeywordPath(keywordPath)
})

/**
 * Converts a canonical keyword object back into the standard joined KMS path form.
 *
 * @param {object} params - Conversion parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {Record<string, string>} params.keywordObject - Canonical keyword object.
 * @returns {string} Joined KMS keyword path.
 *
 * @example
 * buildKeywordPathFromObject({
 *   scheme: 'rucontenttype',
 *   keywordObject: {
 *     URLContentType: 'CollectionURL',
 *     Type: 'PROJECT HOME PAGE',
 *     Subtype: ''
 *   }
 * })
 * // 'CollectionURL > PROJECT HOME PAGE > '
 */
export const buildKeywordPathFromObject = ({
  scheme,
  keywordObject
}) => {
  const slotFields = getKeywordPathSlotFields(scheme)

  if (!Array.isArray(slotFields)) {
    return joinKeywordPath(flattenKeywordPathValue(keywordObject))
  }

  return joinKeywordPath(slotFields.map((fieldName) => keywordObject?.[fieldName]))
}

/**
 * True when any slot/value in a keyword object contains non-blank content.
 *
 * @example
 * hasKeywordPathObjectValue({
 *   Category: 'EARTH SCIENCE',
 *   Topic: '',
 *   Term: ''
 * })
 * // true
 */
export const hasKeywordPathObjectValue = (keywordObject = {}) => Object.values(keywordObject)
  .some((value) => trimKeywordPathSegment(value).length > 0)

/**
 * Builds the canonical KMS keyword path for a scheme from a structured keyword value.
 *
 * Full-path schemes use their canonical slot field order so interior holes are preserved and
 * trailing blanks are padded to the expected slot count. Scalar or unsupported schemes fall back
 * to flattening the value as-is.
 *
 * @example
 * buildKeywordPathFromValue({
 *   scheme: 'sciencekeywords',
 *   keywordValue: {
 *     Category: 'EARTH SCIENCE',
 *     Topic: 'CRYOSPHERE',
 *     VariableLevel1: 'SNOW/ICE'
 *   }
 * })
 * // 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > '
 */
export const buildKeywordPathFromValue = ({
  scheme,
  keywordValue
}) => {
  const slotFields = getKeywordPathSlotFields(scheme)

  if (Array.isArray(slotFields)) {
    return buildKeywordPathFromObject({
      scheme,
      keywordObject: buildKeywordPathObjectFromValue({
        scheme,
        keywordValue
      })
    })
  }

  return joinKeywordPath(flattenKeywordPathValue(keywordValue))
}

/**
 * Builds the exact full-path cache lookup string for a keyword value.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {unknown} params.keywordValue - Extracted keyword fragment.
 * @returns {string|undefined} Canonical full-path lookup value, if present.
 *
 * @example
 * buildFullPathLookupValue({
 *   scheme: 'rucontenttype',
 *   keywordValue: {
 *     URLContentType: 'CollectionURL',
 *     Type: 'PROJECT HOME PAGE'
 *   }
 * })
 * // 'CollectionURL > PROJECT HOME PAGE > '
 */
export const buildFullPathLookupValue = ({
  scheme,
  keywordValue
}) => {
  const slotFields = getKeywordPathSlotFields(scheme)

  if (Array.isArray(slotFields)) {
    const keywordObject = buildKeywordPathObjectFromValue({
      scheme,
      keywordValue
    })

    return hasKeywordPathObjectValue(keywordObject)
      ? buildKeywordPathFromObject({
        scheme,
        keywordObject
      })
      : undefined
  }

  const keywordPath = buildKeywordPathFromValue({
    scheme,
    keywordValue
  })

  return trimKeywordPathSegment(keywordPath).length > 0 ? keywordPath : undefined
}

/**
 * Pulls the short-name portion of a lookup value from a scalar or object-shaped keyword.
 *
 * @param {unknown} keywordValue - Extracted keyword fragment.
 * @returns {string} Short-name value or an empty string when absent.
 *
 * @example
 * extractShortNameLookupValue({ ShortName: 'Aqua' })
 * // 'Aqua'
 */
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
 * Builds the short-name cache lookup value, falling back to the first flattened scalar.
 *
 * @example
 * buildShortNameLookupValue({ ShortName: 'Aqua', LongName: 'Aqua Satellite' })
 * // 'Aqua'
 */
export const buildShortNameLookupValue = (keywordValue) => (
  extractShortNameLookupValue(keywordValue) || flattenKeywordPathValue(keywordValue)[0] || undefined
)

/**
 * Normalizes any extracted keyword fragment into the object form used by lookup code.
 *
 * @param {object} params - Lookup normalization parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {unknown} params.keywordValue - Extracted keyword fragment.
 * @returns {Record<string, string>} Canonical lookup object for the scheme.
 *
 * @example
 * buildKeywordLookupObject({
 *   scheme: 'platforms',
 *   keywordValue: { ShortName: 'Aqua', Type: 'Earth Observation Satellites' }
 * })
 * // { ShortName: 'Aqua' }
 */
export const buildKeywordLookupObject = ({
  scheme,
  keywordValue
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (isLookupFullPathScheme(normalizedScheme)) {
    const slotFields = getKeywordPathSlotFields(normalizedScheme)

    if (Array.isArray(slotFields)) {
      const keywordObject = buildKeywordPathObjectFromValue({
        scheme: normalizedScheme,
        keywordValue
      })

      return hasKeywordPathObjectValue(keywordObject) ? keywordObject : {}
    }

    const fullPathLookupValue = buildFullPathLookupValue({
      scheme: normalizedScheme,
      keywordValue
    })

    return fullPathLookupValue ? { Value: fullPathLookupValue } : {}
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    const shortNameLookupValue = buildShortNameLookupValue(keywordValue)

    return shortNameLookupValue ? { ShortName: shortNameLookupValue } : {}
  }

  return {}
}

/**
 * Applies canonical CSV path padding for schemes that reserve slots for long name, UUID,
 * provider URL, or sparse keyword layouts.
 *
 * This mutates and returns `path` to preserve the historical behavior expected by
 * `buildHierarchicalCsvPaths`.
 *
 * @example
 * formatKeywordCsvPath({
 *   scheme: 'sciencekeywords',
 *   csvHeadersCount: 8,
 *   path: ['EARTH SCIENCE', 'CRYOSPHERE', 'SNOW/ICE'],
 *   isLeaf: true
 * })
 * // ['EARTH SCIENCE', 'CRYOSPHERE', 'SNOW/ICE', '', '', '', '']
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
