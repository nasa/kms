import { baseRegex, conceptIdRegex } from '@/shared/constants/regex'
/**
 * Sanitizes a given concept IRI string by validating its base URL/namespace
 * using a regular expression and sanitizing the concept ID portion.
 *
 * @param {string} conceptIRI - The raw concept IRI to sanitize.
 * @returns {string} The sanitized and validated concept IRI, or an empty string if invalid.
 */
export const sanitizeConceptIRI = (conceptIRI) => {
  if (typeof conceptIRI !== 'string') {
    return ''
  }

  const lastDelimiterIndex = Math.max(
    conceptIRI.lastIndexOf('/'),
    conceptIRI.lastIndexOf(':')
  )

  if (lastDelimiterIndex === -1) {
    return ''
  }

  const base = conceptIRI.slice(0, lastDelimiterIndex + 1)
  const conceptId = conceptIRI.slice(lastDelimiterIndex + 1)

  // Validate the base part against the regex pattern
  if (!baseRegex.test(base)) {
    return ''
  }

  // Sanitize the concept ID portion
  const safeConceptId = conceptId.replace(conceptIdRegex, '')

  return `${base}${safeConceptId}`
}
