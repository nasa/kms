/**
 * Sanitizes a given scheme IRI string by verifying its base URL using a regex
 * and sanitizing the scheme ID portion to contain only allowed characters (letters and spaces).
 *
 * @param {string} schemeIRI - The raw scheme IRI to sanitize.
 * @returns {string} The sanitized scheme IRI, or an empty string if invalid.
 */
export const sanitizeSchemeIRI = (schemeIRI) => {
  if (typeof schemeIRI !== 'string') {
    return ''
  }

  const baseRegex = /^(https?:\/\/[^\s/]+\/[^\s]*\/|urn:[a-zA-Z0-9-:]+:)$/

  const lastDelimiterIndex = Math.max(
    schemeIRI.lastIndexOf('/'),
    schemeIRI.lastIndexOf(':')
  )

  if (lastDelimiterIndex === -1) {
    return ''
  }

  const base = schemeIRI.slice(0, lastDelimiterIndex + 1)
  const schemeId = schemeIRI.slice(lastDelimiterIndex + 1)

  if (!baseRegex.test(base)) {
    return ''
  }

  // Allow only a-z, A-Z, and spaces for the scheme ID segment, matching sanitizeScheme
  const safeSchemeId = schemeId.replace(/[^a-zA-Z\s]/g, '')

  return `${base}${safeSchemeId}`
}
