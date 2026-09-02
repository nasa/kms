import { CSV_FIELDS } from './constants'
import { flattenKeywordPathValue } from './flattenKeywordPathValue'
import { joinKeywordPath } from './joinKeywordPath'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Rebuilds the canonical keyword path string from a keyword object.
 *
 * @param {Object} params The keyword-path reconstruction input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {Object} params.keywordObject Keyword object containing path slots or short-name fields.
 * @returns {string} Canonical ` > `-delimited keyword path.
 */
export const buildKeywordPathFromObject = ({
  scheme,
  keywordObject
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const fields = CSV_FIELDS[normalizedScheme]

  if (!Array.isArray(fields)) {
    return joinKeywordPath(flattenKeywordPathValue(keywordObject))
  }

  const segments = fields.map((fieldName) => keywordObject?.[fieldName])
  const firstNonEmptyIndex = segments.findIndex(
    (segment) => trimKeywordPathSegment(segment).length > 0
  )

  return joinKeywordPath(firstNonEmptyIndex >= 0 ? segments.slice(firstNonEmptyIndex) : segments)
}
