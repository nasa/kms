import { conceptIdRegex } from '@/shared/constants/regex'
/**
 * Sanitizes a given concept ID string by ensuring it is a string
 * and removing any characters that are not alphanumeric or hyphens.
 *
 * @param {string} conceptId - The raw concept ID to sanitize.
 * @returns {string} The sanitized concept ID containing only safe characters, or an empty string if invalid.
 */
export const sanitizeConceptId = (conceptId) => {
  if (typeof conceptId !== 'string') {
    return ''
  }

  // Allow only alphanumeric, hyphens, and underscores, removing anything else
  return conceptId.replace(conceptIdRegex, '')
}
