import { KEYWORD_PATH_SEPARATOR } from './constants'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Joins normalized path segments with the canonical redis keyword separator.
 *
 * @param {Array<any>} [segments=[]] Ordered keyword path segments.
 * @returns {string} Canonical ` > `-delimited keyword path.
 */
export const joinKeywordPath = (segments = []) => segments
  .map((segment) => trimKeywordPathSegment(segment))
  .join(KEYWORD_PATH_SEPARATOR)
