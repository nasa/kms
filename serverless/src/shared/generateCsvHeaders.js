import {
  getConceptSchemeDetailsQuery
} from '@/shared/operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

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
export const generateCsvHeaders = async (scheme, version, maxColumns) => {
  const uuid = 'UUID'

  try {
    // Make a SPARQL request to fetch concept scheme details
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeDetailsQuery(scheme),
      version
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings
    // Get the CSV headers string from the first triple
    const notation = triples[0]?.notation.value

    if (maxColumns === 2) {
      return [notation, uuid]
    }

    const headers = [notation]
    const levelCount = maxColumns - 2

    // eslint-disable-next-line no-plusplus
    for (let i = 1; i <= levelCount; i++) {
      headers.push(`Level${i}`)
    }

    headers.push(uuid)

    return headers
  } catch (error) {
    // Log and re-throw any errors that occur during the process
    console.error('Error fetching triples:', error)
    throw error
  }
}
