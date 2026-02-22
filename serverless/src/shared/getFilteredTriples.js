import { getConceptsQuery } from '@/shared/operations/queries/getConceptsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves filtered triples from the configured SPARQL endpoint for a specific version.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query using the getConceptsQuery function based on the specified parameters.
 * 2. Sends a POST request to the SPARQL endpoint with the constructed query.
 * 3. Processes and returns the SPARQL query results.
 *
 * @async
 * @function getFilteredTriples
 * @param {Object} params - The parameters for filtering triples.
 * @param {string} [params.conceptScheme] - The concept scheme to filter by.
 * @param {string} [params.pattern] - The pattern to filter concepts by (e.g., to match against prefLabels).
 * @param {string} params.version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @param {number} params.pageNum - The page number for pagination.
 * @param {number} params.pageSize - The number of items per page.
 * @returns {Promise<Array>} A promise that resolves to an array of binding objects from the SPARQL results.
 *                           Each binding object contains 's', 'p', 'o', and potentially 'bn', 'bp', 'bo' properties,
 *                           representing subjects, predicates, objects, and related blank node information.
 *
 * @throws {Error} If the HTTP request fails, if the response is not ok,
 *                 or if there's any error during the fetching or processing of the triples.
 *
 * @example
 * // Fetch triples for a specific concept scheme in the published version, page 1 with 10 items per page
 * try {
 *   const triples = await getFilteredTriples({
 *     conceptScheme: 'sciencekeywords',
 *     version: 'published',
 *     pageNum: 1,
 *     pageSize: 10
 *   });
 *   console.log(triples);
 * } catch (error) {
 *   console.error('Failed to get triples:', error);
 * }
 *
 * @example
 * // Fetch triples matching a pattern in the draft version, page 2 with 20 items per page
 * try {
 *   const triples = await getFilteredTriples({
 *     pattern: 'EARTH SCIENCE',
 *     version: 'draft',
 *     pageNum: 2,
 *     pageSize: 20
 *   });
 *   console.log(triples);
 * } catch (error) {
 *   console.error('Failed to get triples:', error);
 * }
 *
 * @see sparqlRequest - Used to make the SPARQL query requests.
 * @see getConceptsQuery - Used to generate the SPARQL query for fetching concepts and their related triples.
 */

export const getFilteredTriples = async ({
  conceptScheme, pattern, version, pageNum, pageSize
}) => {
  try {
    const offset = (pageNum - 1) * pageSize
    const query = getConceptsQuery(conceptScheme, pattern, pageSize, offset)

    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: query,
      version,
      // For high-volume read endpoints, fail fast to avoid cascading retries/timeouts.
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '30000', 10)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const results = await response.json()

    return results.results.bindings
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}
