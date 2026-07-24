/**
 * Sanitizes a given scheme string by ensuring it is a string
 * and removing any characters that are not letters or spaces.
 *
 * @param {string} scheme - The raw scheme string to sanitize.
 * @returns {string} The sanitized scheme containing only allowed characters, or an empty string if invalid.
 */
export const sanitizeScheme = (scheme) => {
  if (typeof scheme !== 'string') {
    return ''
  }

  // Remove any character that is not a-z, A-Z, space, hyphen, or underscore
  return scheme.replace(/[^a-zA-Z\s-_]/g, '')
}
