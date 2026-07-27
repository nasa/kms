import { baseRegex, conceptIdRegex } from '@/shared/constants/regex'

/**
 * Sanitizes a given concept IRI string, distinguishing "not provided" from
 * "provided but invalid" so callers can tell the two apart instead of
 * having both collapse into the same empty-string result (and instead of
 * a malformed ID segment being silently rewritten into something else).
 *
 * Return contract:
 *   - Missing input (null, undefined, or '') -> '' (no value supplied)
 *   - Valid input (a recognized base + a concept ID containing only alphanumeric
 *     characters and hyphens) -> returned unchanged
 *   - Invalid, non-empty input (wrong type, no recognizable base/ID
 *     delimiter, a base that fails baseRegex, or a concept ID containing
 *     disallowed characters) -> null (a distinct, explicit "invalid" signal)
 *
 * Callers that need to reject bad input should check for null explicitly,
 * e.g.:
 *   const safeConceptIRI = sanitizeConceptIRI(conceptIRI)
 *   if (safeConceptIRI === null) {
 *     throw new Error('Invalid concept IRI provided')
 *   }
 *
 * @param {*} conceptIRI - The raw concept IRI to sanitize.
 * @returns {string|null} '' if missing, the unchanged IRI if valid, or
 *   null if it was supplied but invalid.
 */
export const sanitizeConceptIRI = (conceptIRI) => {
  if (conceptIRI === null || conceptIRI === undefined || conceptIRI === '') {
    return ''
  }

  if (typeof conceptIRI !== 'string') {
    return null
  }

  const lastDelimiterIndex = Math.max(
    conceptIRI.lastIndexOf('/'),
    conceptIRI.lastIndexOf(':')
  )

  if (lastDelimiterIndex === -1) {
    return null
  }

  const base = conceptIRI.slice(0, lastDelimiterIndex + 1)
  const conceptId = conceptIRI.slice(lastDelimiterIndex + 1)

  // Validate the base part against the regex pattern
  if (!baseRegex.test(base)) {
    return null
  }

  // Allow only alphanumeric characters and hyphens for the concept ID segment,
  // matching sanitizeConceptId. If any character had to be stripped, the input
  // wasn't a valid concept ID to begin with - reject rather than silently
  // rewrite it into a different identifier.
  const safeConceptId = conceptId.replace(conceptIdRegex, '')

  if (safeConceptId !== conceptId) {
    return null
  }

  return `${base}${safeConceptId}`
}
