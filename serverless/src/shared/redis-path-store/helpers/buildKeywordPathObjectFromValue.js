import { buildKeywordPathObjectFromSegments } from './buildKeywordPathObjectFromSegments'
import { FULL_PATH_VALUE_FIELDS } from './constants'
import { flattenKeywordPathValue } from './flattenKeywordPathValue'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'

/**
 * Builds a slotted keyword object from either named fields or raw keyword values.
 *
 * @param {Object} params The keyword-object build input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {any} params.keywordValue Raw keyword input, typically a path string, array, or object.
 * @returns {Object} Slotted keyword object for the scheme, or an empty object when the scheme does
 *   not use fixed full-path slots.
 */
export const buildKeywordPathObjectFromValue = ({
  scheme,
  keywordValue
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const slotFields = FULL_PATH_VALUE_FIELDS[normalizedScheme]

  if (!Array.isArray(slotFields)) {
    return {}
  }

  if (keywordValue && typeof keywordValue === 'object' && !Array.isArray(keywordValue)) {
    return buildKeywordPathObjectFromSegments({
      scheme: normalizedScheme,
      segments: slotFields.map((fieldName) => keywordValue[fieldName])
    })
  }

  return buildKeywordPathObjectFromSegments({
    scheme: normalizedScheme,
    segments: flattenKeywordPathValue(keywordValue)
  })
}
