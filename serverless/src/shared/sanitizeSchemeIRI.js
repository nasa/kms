import { baseRegex, schemeRegex } from '@/shared/constants/regex'

/**
 * Sanitizes a given scheme IRI string, distinguishing "not provided" from
 * "provided but invalid" so callers can tell the two apart instead of
 * having both collapse into the same empty-string result (and instead of
 * a malformed ID segment being silently rewritten into something else).
 *
 * Return contract:
 *   - Missing input (null, undefined, or '') -> '' (no value supplied)
 *   - Valid input (a recognized base + a scheme ID containing only letters,
 *     hyphens, and underscores) -> returned unchanged
 *   - Invalid, non-empty input (wrong type, no recognizable base/ID
 *     delimiter, a base that fails baseRegex, or a scheme ID containing
 *     disallowed characters) -> null (a distinct, explicit "invalid" signal)
 *
 * Callers that need to reject bad input should check for null explicitly,
 * e.g.:
 *   const safeSchemeIRI = sanitizeSchemeIRI(schemeIRI)
 *   if (safeSchemeIRI === null) {
 *     throw new Error('Invalid scheme IRI provided')
 *   }
 *
 * @param {*} schemeIRI - The raw scheme IRI to sanitize.
 * @returns {string|null} '' if missing, the unchanged IRI if valid, or
 *   null if it was supplied but invalid.
 */
export const sanitizeSchemeIRI = (schemeIRI) => {
  if (schemeIRI === null || schemeIRI === undefined || schemeIRI === '') {
    return ''
  }

  if (typeof schemeIRI !== 'string') {
    return null
  }

  const lastDelimiterIndex = Math.max(
    schemeIRI.lastIndexOf('/'),
    schemeIRI.lastIndexOf(':')
  )

  if (lastDelimiterIndex === -1) {
    // Non-empty, but not a recognizable IRI shape at all - invalid, not missing.
    return null
  }

  const base = schemeIRI.slice(0, lastDelimiterIndex + 1)
  const schemeId = schemeIRI.slice(lastDelimiterIndex + 1)

  if (!baseRegex.test(base)) {
    return null
  }

  // Allow only a-z, A-Z, hyphens, and underscores for the scheme ID segment,
  // matching sanitizeScheme. If any character had to be stripped, the input
  // wasn't a valid scheme ID to begin with - reject rather than silently
  // rewrite it into a different identifier.
  const safeSchemeId = schemeId.replace(schemeRegex, '')

  if (safeSchemeId !== schemeId) {
    return null
  }

  return `${base}${safeSchemeId}`
}
