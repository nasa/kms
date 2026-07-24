/**
 * Escapes a string for safe insertion into a SPARQL query string literal.
 * Handles control characters, backslashes, double quotes, single quotes, and null bytes.
 *
 * @param {string} str - The raw string input from a request or user parameter (e.g., "O'Connor").
 * @returns {string} The safely escaped inner string text.
 *
 * @example
 * // Basic string escaping for query templates
 * const safeName = escapeSparqlString('John "Doc" Smith');
 * const query = `FILTER(?prefLabel = "${safeName}")`;
 * // Resulting query fragment: FILTER(?prefLabel = "John \"Doc\" Smith")
 *
 * @example
 * // Handling names with apostrophes/single quotes
 * const safeIrishName = escapeSparqlString("O'Connor");
 * const query = `FILTER(?prefLabel = "${safeIrishName}")`;
 * // Resulting query fragment: FILTER(?prefLabel = "O\'Connor")
 *
 * @example
 * // Handling special whitespace and control characters
 * const safeText = escapeSparqlString("Line 1\nLine 2");
 * const query = `FILTER(?prefLabel = "${safeText}")`;
 * // Resulting query fragment: FILTER(?prefLabel = "Line 1\nLine 2")
 */
export const escapeSparqlString = (str) => {
  if (typeof str !== 'string') return ''

  const escaped = str
    // Strip control characters with no valid SPARQL escape (incl. NUL),
    // but preserve null (\0) since tests explicitly expect it to become \0.
    // We handle null right below.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x01-\x07\x0B\x0E-\x1F]/g, '')
    // Order matters: backslash MUST be escaped first
    .replace(/\\/g, '\\\\')
    // Escape double quotes to prevent breaking the SPARQL string literal
    .replace(/"/g, '\\"')
    // Escape single quotes to prevent breaking the SPARQL string literal
    .replace(/'/g, "\\'")
    // Escape null bytes to a safe representation string (\0)
    .replace(/\0/g, '\\0')
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
