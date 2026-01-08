/**
 * Escapes special characters in a string for use in SPARQL queries.
 *
 * This function performs the following escaping operations:
 * 1. Escapes backslashes, double quotes, and single quotes by prefixing them with a backslash.
 * 2. Replaces null characters (ASCII 0) with the string '\0'.
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string safe for use in SPARQL queries.
 *
 * @example
 * escapeSparqlString('Hello "world"') // Returns: 'Hello \\"world\\"'
 * escapeSparqlString("It's a test") // Returns: "It\\'s a test"
 * escapeSparqlString('Null\0character') // Returns: 'Null\\0character'
 *
 * @throws {TypeError} If the input is not a string, an empty string is returned.
 */
export const escapeSparqlString = (str) => {
  if (typeof str !== 'string') return ''

  return str
    .replace(/[\\"']/g, '\\$&')
    .split('')
    .map((char) => (char.charCodeAt(0) === 0 ? '\\0' : char))
    .join('')
}
