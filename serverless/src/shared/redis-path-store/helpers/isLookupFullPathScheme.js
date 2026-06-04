import { LOOKUP_FULL_PATH_SCHEME_SET } from './constants'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'

/**
 * Returns true when the scheme uses canonical full-path keyword lookups.
 *
 * @param {string} scheme Keyword scheme name.
 * @returns {boolean} `true` when the scheme resolves lookups by canonical full path.
 */
export const isLookupFullPathScheme = (scheme) => LOOKUP_FULL_PATH_SCHEME_SET.has(
  normalizeKeywordScheme(scheme)
)
