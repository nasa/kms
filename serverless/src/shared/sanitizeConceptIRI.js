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

  // Regex to validate and capture the base part:
  // 1. Matches HTTP/HTTPS URLs up to the final path segment (e.g., https://example.com/concept/)
  // 2. OR matches URN namespaces up to the final segment (e.g., urn:example:concept:)
  const baseRegex = /^(https?:\/\/[^\s/]+\/[^\s]*\/|urn:[a-zA-Z0-9-:]+:)$/

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
  const safeConceptId = conceptId.replace(/[^a-zA-Z0-9-]/g, '')

  return `${base}${safeConceptId}`
}
