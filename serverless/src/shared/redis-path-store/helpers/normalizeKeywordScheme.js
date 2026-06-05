/**
 * Normalizes a keyword scheme name for case-insensitive comparisons.
 *
 * @param {string} scheme Keyword scheme name.
 * @returns {string} Lowercased scheme name.
 */
export const normalizeKeywordScheme = (scheme) => String(scheme || '').toLowerCase()
