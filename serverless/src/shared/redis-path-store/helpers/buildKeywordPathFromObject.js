import { FULL_PATH_VALUE_FIELDS, SHORT_NAME_OBJECT_FIELDS } from './constants'
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
  const slotFields = FULL_PATH_VALUE_FIELDS[normalizedScheme]
  const shortNameObjectFields = SHORT_NAME_OBJECT_FIELDS[normalizedScheme]

  if (!Array.isArray(slotFields)) {
    if (Array.isArray(shortNameObjectFields)) {
      const keywordPathSegments = shortNameObjectFields.map(
        (fieldName) => keywordObject?.[fieldName]
      )
      const firstNonEmptyIndex = keywordPathSegments.findIndex(
        (segment) => trimKeywordPathSegment(segment).length > 0
      )

      return joinKeywordPath(
        firstNonEmptyIndex >= 0
          ? keywordPathSegments.slice(firstNonEmptyIndex)
          : keywordPathSegments
      )
    }

    return joinKeywordPath(flattenKeywordPathValue(keywordObject))
  }

  return joinKeywordPath(slotFields.map((fieldName) => keywordObject?.[fieldName]))
}
