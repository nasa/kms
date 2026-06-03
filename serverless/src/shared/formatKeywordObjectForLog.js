import { hasMeaningfulKeywordObject } from './hasMeaningfulKeywordObject'

/**
 * Formats a keyword object for log lines, falling back to `n/a` when it is empty or missing.
 *
 * @param {Record<string, unknown>|null|undefined} keywordObject - Candidate keyword object.
 * @returns {string} JSON string for meaningful objects, otherwise `n/a`.
 */
export const formatKeywordObjectForLog = (keywordObject) => (
  hasMeaningfulKeywordObject(keywordObject)
    ? JSON.stringify(keywordObject)
    : 'n/a'
)

export default formatKeywordObjectForLog
