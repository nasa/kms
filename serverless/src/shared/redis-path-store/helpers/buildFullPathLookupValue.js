import { buildKeywordPathFromObject } from './buildKeywordPathFromObject'
import { buildKeywordPathObjectFromValue } from './buildKeywordPathObjectFromValue'
import { FULL_PATH_VALUE_FIELDS } from './constants'
import { flattenKeywordPathValue } from './flattenKeywordPathValue'
import { hasKeywordObjectValue } from './hasKeywordObjectValue'
import { joinKeywordPath } from './joinKeywordPath'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Builds the canonical keyword path string from raw keyword input.
 *
 * @param {Object} params The keyword-path build input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {any} params.keywordValue Raw keyword input, typically a path string, array, or object.
 * @returns {string} Canonical ` > `-delimited keyword path.
 */
export const buildKeywordPathFromValue = ({
  scheme,
  keywordValue
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const slotFields = FULL_PATH_VALUE_FIELDS[normalizedScheme]

  if (Array.isArray(slotFields)) {
    return buildKeywordPathFromObject({
      scheme: normalizedScheme,
      keywordObject: buildKeywordPathObjectFromValue({
        scheme: normalizedScheme,
        keywordValue
      })
    })
  }

  return joinKeywordPath(flattenKeywordPathValue(keywordValue))
}

/**
 * Builds the canonical full-path lookup value when the input contains usable path content.
 *
 * @param {Object} params The lookup build input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {any} params.keywordValue Raw keyword input, typically a path string, array, or object.
 * @returns {string|undefined} Canonical full-path lookup value, or `undefined` when the input does
 *   not contain usable path content.
 */
export const buildFullPathLookupValue = ({
  scheme,
  keywordValue
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const slotFields = FULL_PATH_VALUE_FIELDS[normalizedScheme]

  if (Array.isArray(slotFields)) {
    const keywordObject = buildKeywordPathObjectFromValue({
      scheme: normalizedScheme,
      keywordValue
    })

    return hasKeywordObjectValue(keywordObject)
      ? buildKeywordPathFromObject({
        scheme: normalizedScheme,
        keywordObject
      })
      : undefined
  }

  const keywordPath = buildKeywordPathFromValue({
    scheme: normalizedScheme,
    keywordValue
  })

  return trimKeywordPathSegment(keywordPath).length > 0 ? keywordPath : undefined
}
