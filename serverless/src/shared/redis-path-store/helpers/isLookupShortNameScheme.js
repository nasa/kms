import { LOOKUP_SHORT_NAME_SCHEME_SET } from './constants'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'

/**
 * Returns true when the scheme uses short-name keyword lookups.
 *
 * @param {string} scheme Keyword scheme name.
 * @returns {boolean} `true` when the scheme resolves lookups by short name.
 */
export const isLookupShortNameScheme = (scheme) => LOOKUP_SHORT_NAME_SCHEME_SET.has(
  normalizeKeywordScheme(scheme)
)
