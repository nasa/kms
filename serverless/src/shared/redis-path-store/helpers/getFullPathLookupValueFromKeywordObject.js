import { buildFullPathLookupValue } from './buildFullPathLookupValue'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Builds a canonical full-path lookup value only when the keyword object has usable content.
 *
 * @param {Object} params The lookup extraction input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {Object} params.keywordObject Keyword object containing full-path fields.
 * @returns {string|undefined} Canonical full-path lookup value, or `undefined` when the keyword
 *   object does not contain usable content.
 */
export const getFullPathLookupValueFromKeywordObject = ({
  scheme,
  keywordObject
}) => {
  const fullPath = buildFullPathLookupValue({
    scheme,
    keywordValue: keywordObject
  })

  return trimKeywordPathSegment(fullPath).length > 0 ? fullPath : undefined
}
