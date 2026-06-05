import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Returns true when a keyword object contains at least one non-blank value.
 *
 * @param {Object} [keywordObject={}] Keyword object to inspect.
 * @returns {boolean} `true` when at least one field contains a non-blank value.
 */
export const hasKeywordObjectValue = (keywordObject = {}) => Object.values(keywordObject)
  .some((value) => trimKeywordPathSegment(value).length > 0)
