import { getTotalCountQuery } from '@/shared/operations/queries/getTotalCountQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves the total count of concepts from the configured SPARQL endpoint for a specific version.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query to count concepts based on the specified concept scheme and pattern.
 * 2. Sends a request to the SPARQL endpoint using sparqlRequest.
 * 3. Processes the SPARQL query results and returns the total count.
 *
 * @async
 * @function getTotalConceptCount
 * @param {Object} params - The parameters for counting concepts.
 * @param {string} [params.conceptScheme] - The concept scheme to filter by.
 * @param {string} [params.pattern] - The pattern to filter concepts by.
 * @param {string} params.version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<number>} A promise that resolves to the total count of concepts matching the criteria.
 *
 * @throws {Error} If the HTTP request fails, if the response is not ok,
 *                 or if there's any error during the fetching or processing of the count.
 *
 * @example
 * // Get total count of concepts in a specific concept scheme in the published version
 * try {
 *   const count = await getTotalConceptCount({ conceptScheme: 'sciencekeywords', version: 'published' });
 *   console.log('Total concepts:', count);
 * } catch (error) {
 *   console.error('Failed to get concept count:', error);
 * }
 *
 * @example
 * // Get total count of concepts matching a pattern in the draft version
 * try {
 *   const count = await getTotalConceptCount({ pattern: 'EARTH SCIENCE', version: 'draft' });
 *   console.log('Matching concepts:', count);
 * } catch (error) {
 *   console.error('Failed to get concept count:', error);
 * }
 *
 * @see sparqlRequest - Used to make the SPARQL query request.
 * @see getTotalCountQuery - Used to generate the SPARQL query for counting concepts.
 */
export const getTotalConceptCount = async ({ conceptScheme, pattern, version }) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getTotalCountQuery({
        conceptScheme,
        pattern
      }),
      version,
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '8000', 10)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    return parseInt(json.results.bindings[0].count.value, 10)
  } catch (error) {
    console.error('Error fetching total concept count:', error)
    throw error
  }
}
