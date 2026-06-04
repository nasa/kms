/**
 * Trims a single keyword-path segment while preserving blank slot markers.
 *
 * @param {any} segment Raw path segment value.
 * @returns {string} Trimmed path segment, or an empty string for nullish values.
 */
export const trimKeywordPathSegment = (segment) => {
  if (segment === undefined || segment === null) {
    return ''
  }

  return String(segment).trim()
}
