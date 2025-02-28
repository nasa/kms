/**
 * Generates CSV headers based on the provided scheme and maximum number of columns.
 *
 * @param {string} scheme - The scheme to be included in the headers.
 * @param {number} maxColumns - The maximum number of columns in the CSV.
 * @returns {string[]} An array of CSV header strings.
 *
 * @example
 * // Generate headers for a CSV with 2 columns
 * const headers1 = generateCsvHeaders('MyScheme', 2);
 * console.log(headers1);
 * // Output: ['MyScheme', 'UUID']
 *
 * @example
 * // Generate headers for a CSV with 5 columns
 * const headers2 = generateCsvHeaders('AnotherScheme', 5);
 * console.log(headers2);
 * // Output: ['AnotherScheme', 'Level1', 'Level2', 'Level3', 'UUID']
 *
 * @example
 * // Generate headers for a CSV with 3 columns
 * const headers3 = generateCsvHeaders('TestScheme', 3);
 * console.log(headers3);
 * // Output: ['TestScheme', 'Level1', 'UUID']
 */
export const generateCsvHeaders = (scheme, maxColumns) => {
  const uuid = 'UUID'

  if (maxColumns === 2) {
    return [scheme, uuid]
  }

  const headers = [scheme]
  const levelCount = maxColumns - 2

  // eslint-disable-next-line no-plusplus
  for (let i = 1; i <= levelCount; i++) {
    headers.push(`Level${i}`)
  }

  headers.push(uuid)

  return headers
}
