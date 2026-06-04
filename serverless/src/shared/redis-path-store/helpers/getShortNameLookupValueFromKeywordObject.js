import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Extracts the canonical short-name lookup value from a keyword object.
 *
 * @param {Object} keywordObject Keyword object containing a `ShortName` field.
 * @returns {string|undefined} Trimmed short-name lookup value, or `undefined` when blank.
 */
export const getShortNameLookupValueFromKeywordObject = (keywordObject) => {
  const shortName = trimKeywordPathSegment(keywordObject?.ShortName)

  return shortName.length > 0 ? shortName : undefined
}
