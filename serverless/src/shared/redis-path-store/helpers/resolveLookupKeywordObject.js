import { buildFullPathLookupValue } from './buildFullPathLookupValue'
import { buildKeywordPathObjectFromValue } from './buildKeywordPathObjectFromValue'
import { flattenKeywordPathValue } from './flattenKeywordPathValue'
import { hasKeywordObjectValue } from './hasKeywordObjectValue'
import { isLookupFullPathScheme } from './isLookupFullPathScheme'
import { isLookupShortNameScheme } from './isLookupShortNameScheme'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'

/**
 * Extracts a short-name lookup value from either scalar or structured keyword input.
 *
 * @param {any} keywordValue Raw keyword input.
 * @returns {string} Best-effort short-name value, or an empty string when none can be derived.
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
 * Builds the best available short-name lookup value from raw keyword input.
 *
 * @param {any} keywordValue Raw keyword input.
 * @returns {string|undefined} Best-effort short-name lookup value.
 */
export const buildShortNameLookupValue = (keywordValue) => (
  extractShortNameLookupValue(keywordValue) || flattenKeywordPathValue(keywordValue)[0] || undefined
)

/**
 * Builds the normalized lookup keyword object for a scheme from raw keyword input.
 *
 * @param {Object} params The lookup-object build input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {any} params.keywordValue Raw keyword input.
 * @returns {Object} Normalized lookup keyword object for the scheme.
 */
export const buildKeywordLookupObject = ({
  scheme,
  keywordValue
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (isLookupFullPathScheme(normalizedScheme)) {
    const keywordObject = buildKeywordPathObjectFromValue({
      scheme: normalizedScheme,
      keywordValue
    })

    if (hasKeywordObjectValue(keywordObject)) {
      return keywordObject
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
 * Chooses the best lookup keyword object from explicit object input or raw keyword value input.
 *
 * @param {Object} params The lookup keyword-object resolution input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {Object} [params.keywordObject] Explicit keyword object provided by the caller.
 * @param {any} params.keywordValue Raw keyword input used as a fallback source.
 * @returns {Object} Normalized lookup keyword object for the scheme.
 */
export const resolveLookupKeywordObject = ({
  scheme,
  keywordObject,
  keywordValue
}) => {
  if (hasKeywordObjectValue(keywordObject)) {
    return buildKeywordLookupObject({
      scheme,
      keywordValue: keywordObject
    })
  }

  return buildKeywordLookupObject({
    scheme,
    keywordValue
  })
}
