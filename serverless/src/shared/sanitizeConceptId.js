import { conceptIdRegex } from '@/shared/constants/regex'

/**
 * Sanitizes a given concept ID string, distinguishing "not provided" from
 * "provided but invalid" so callers can tell the two apart instead of
 * having both collapse into the same empty-string result.
 *
 * Return contract:
 *   - Missing input (null, undefined, or '') -> '' (no value supplied)
 *   - Valid input (only alphanumeric characters and hyphens) -> returned unchanged
 *   - Invalid, non-empty input (wrong type, or contains disallowed
 *     characters) -> null (a distinct, explicit "invalid" signal)
 *
 * Callers that need to reject bad input should check for null explicitly,
 * e.g.:
 *   const safeConceptId = sanitizeConceptId(conceptId)
 *   if (safeConceptId === null) {
 *     throw new Error('Invalid conceptId provided')
 *   }
 *
 * @param {*} conceptId - The raw concept ID to sanitize.
 * @returns {string|null} '' if missing, the unchanged concept ID if valid,
 *   or null if it was supplied but invalid.
 */
export const sanitizeConceptId = (conceptId) => {
  if (conceptId === null || conceptId === undefined || conceptId === '') {
    return ''
  }

  if (typeof conceptId !== 'string') {
    return null
  }

  const sanitized = conceptId.replace(conceptIdRegex, '')

  return sanitized === conceptId ? sanitized : null
}
