import { FULL_PATH_VALUE_FIELDS } from './constants'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Builds a slotted keyword object from normalized path segments.
 *
 * @param {Object} params The path-segment build input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {string[]} [params.segments=[]] Ordered keyword path segments.
 * @returns {Object} Slotted keyword-path object padded to the scheme's field count.
 */
export const buildKeywordPathObjectFromSegments = ({
  scheme,
  segments = []
}) => {
  const slotFields = FULL_PATH_VALUE_FIELDS[normalizeKeywordScheme(scheme)]

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
