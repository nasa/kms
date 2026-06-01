const HISTORICAL_CACHE_PATH_SEPARATOR = ' > '

const FULL_PATH_VALUE_FIELDS = {
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
}

const trimPathSegment = (segment) => {
  if (segment === undefined || segment === null) {
    return ''
  }

  return String(segment).trim()
}

const flattenKeywordValue = (keywordValue) => {
  if (keywordValue === undefined || keywordValue === null) {
    return []
  }

  if (Array.isArray(keywordValue)) {
    return keywordValue.flatMap(flattenKeywordValue)
  }

  if (typeof keywordValue === 'object') {
    return Object.values(keywordValue).flatMap(flattenKeywordValue)
  }

  return [trimPathSegment(keywordValue)]
}

/**
 * Builds the canonical historical-cache lookup path for schemes whose keys depend on
 * a slotted hierarchical path.
 *
 * Some UMM-C extraction paths only carry the populated keyword levels, but the historical
 * Redis cache stores canonical KMS paths with intentional blank slots preserved.
 * This helper pads the extracted path back to the canonical slot count before joining it
 * with the normal KMS separator.
 *
 * @param {object} params - Lookup-path parameters.
 * @param {string} params.scheme - KMS scheme namespace.
 * @param {unknown} params.keywordValue - Extracted UMM-C keyword fragment for the invalid value.
 * @returns {string} Canonical historical cache full path.
 *
 * @example
 * buildHistoricalKeywordLookupPath({
 *   scheme: 'sciencekeywords',
 *   keywordValue: {
 *     Category: 'EARTH SCIENCE',
 *     Topic: 'CRYOSPHERE',
 *     Term: '',
 *     VariableLevel1: 'SNOW/ICE'
 *   }
 * })
 * // 'EARTH SCIENCE > CRYOSPHERE >  > SNOW/ICE >  >  > '
 *
 * @example
 */
export const buildHistoricalKeywordLookupPath = ({
  scheme,
  keywordValue
}) => {
  const normalizedScheme = String(scheme || '').toLowerCase()
  const valueFields = FULL_PATH_VALUE_FIELDS[normalizedScheme]
  let segments = []

  if (
    Array.isArray(valueFields)
    && keywordValue
    && typeof keywordValue === 'object'
    && !Array.isArray(keywordValue)
  ) {
    segments = valueFields.map((fieldName) => trimPathSegment(keywordValue[fieldName]))
  } else {
    segments = flattenKeywordValue(keywordValue)
  }

  if (Array.isArray(valueFields) && valueFields.length > segments.length) {
    while (segments.length < valueFields.length) {
      segments.push('')
    }
  }

  return segments.join(HISTORICAL_CACHE_PATH_SEPARATOR)
}

export default buildHistoricalKeywordLookupPath
