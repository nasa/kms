import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Splits a canonical keyword path into trimmed slot values.
 *
 * @param {string} [keywordPath=''] Canonical ` > `-delimited keyword path.
 * @returns {string[]} Trimmed path segments.
 */
export const splitKeywordPath = (keywordPath = '') => String(keywordPath)
  .split('>')
  .map((segment) => trimKeywordPathSegment(segment))
