import { schemeRegex } from '@/shared/constants/regex'

/**
 * Sanitizes a given scheme string, distinguishing "not provided" from
 * "provided but invalid" so callers can tell the two apart instead of
 * having both collapse into the same empty-string result.
 *
 * Return contract:
 *   - Missing input (null, undefined, or '') -> '' (no filter/value supplied)
 *   - Valid input (only letters, hyphens, underscores) -> returned unchanged
 *   - Invalid, non-empty input (wrong type, or contains disallowed
 *     characters) -> null (a distinct, explicit "invalid" signal)
 *
 * Callers that need to reject bad input should check for null explicitly,
 * e.g.:
 *   const safeScheme = sanitizeScheme(scheme)
 *   if (safeScheme === null) {
 *     throw new Error('Invalid scheme provided')
 *   }
 *
 * @param {*} scheme - The raw scheme value to sanitize.
 * @returns {string|null} '' if missing, the unchanged scheme if valid,
 *   or null if it was supplied but invalid.
 */
export const sanitizeScheme = (scheme) => {
  if (scheme === null || scheme === undefined || scheme === '') {
    return ''
  }

  if (typeof scheme !== 'string') {
    return null
  }

  const sanitized = scheme.replace(schemeRegex, '')

  return sanitized === scheme ? sanitized : null
}
