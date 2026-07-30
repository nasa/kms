/**
 * Escapes a string for safe insertion into a SPARQL query string literal.
 * Handles control characters, backslashes, double quotes, single quotes, and null bytes.
 *
 * @param {*} str - The raw string input from a request or user parameter.
 * @returns {string|null} The safely escaped string, '' if missing/empty, or null if invalid.
 */
export const escapeSparqlString = (str) => {
  if (str === null || str === undefined || str === '') {
    return ''
  }

  if (typeof str !== 'string') {
    return null
  }

  let decoded = str
  let previous
  let iterations = 0
  const maxIterations = 3 // Prevents infinite loops/DoS from malicious input

  // Iteratively decode to strip away multi-layer (single, double, etc.) URL encoding
  do {
    previous = decoded
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      // If decoding fails due to malformed sequences, treat as invalid input
      return null
    }

    iterations += 1
  } while (decoded !== previous && iterations < maxIterations)

  const escaped = decoded
    // Strip control characters with no valid SPARQL escape, including NUL bytes
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x07\x0B\x0E-\x1F]/g, '')
    // Order matters: backslash MUST be escaped first
    .replace(/\\/g, '\\\\')
    // Escape double quotes to prevent breaking the SPARQL string literal
    .replace(/"/g, '\\"')
    // Escape single quotes to prevent breaking the SPARQL string literal
    .replace(/'/g, "\\'")
    // Escape newline characters into literal backslash-n format
    .replace(/\n/g, '\\n')
    // Escape carriage return characters into literal backslash-r format
    .replace(/\r/g, '\\r')
    // Escape tab characters into literal backslash-t format
    .replace(/\t/g, '\\t')
    // Escape backspace control characters into literal backslash-b format
    // eslint-disable-next-line no-control-regex
    .replace(/\x08/g, '\\b')
    // Escape form feed characters into literal backslash-f format
    .replace(/\f/g, '\\f')

  return escaped
}
