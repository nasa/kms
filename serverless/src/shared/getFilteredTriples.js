import {
  getTriplesForConceptSchemeOrPatternQuery
} from '@/shared/operations/queries/getTriplesForConceptSchemeOrPatternQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves filtered triples from the configured SPARQL endpoint for a specific version.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query to fetch triples based on the specified concept scheme, pattern, and version.
 * 2. Sends a request to the SPARQL endpoint using sparqlRequest.
 * 3. Processes and returns the SPARQL query results.
 *
 * @async
 * @function getFilteredTriples
 * @param {Object} params - The parameters for filtering triples.
 * @param {string} [params.conceptScheme] - The concept scheme to filter by.
 * @param {string} [params.pattern] - The pattern to filter triples by.
 * @param {string} params.version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects.
 *                           Each triple object contains 's' (subject), 'p' (predicate), and 'o' (object) properties.
 *
 * @throws {Error} If the HTTP request fails, if the response is not ok,
 *                 or if there's any error during the fetching or processing of the triples.
 *
 * @example
 * // Fetch triples for a specific concept scheme in the published version
 * try {
 *   const triples = await getFilteredTriples({ conceptScheme: 'sciencekeywords', version: 'published' });
 *   console.log(triples);
 * } catch (error) {
 *   console.error('Failed to get triples:', error);
 * }
 *
 * @example
 * // Fetch triples matching a pattern in the draft version
 * try {
 *   const triples = await getFilteredTriples({ pattern: 'EARTH SCIENCE', version: 'draft' });
 *   console.log(triples);
 * } catch (error) {
 *   console.error('Failed to get triples:', error);
 * }
 *
 * @see getTriplesForConceptSchemeOrPatternQuery - Used to construct the SPARQL query.
 * @see sparqlRequest - Used to make the SPARQL query request.
 */

export const getFilteredTriples = async ({ conceptScheme, pattern, version }) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getTriplesForConceptSchemeOrPatternQuery({
        conceptScheme,
        pattern
      }),
      version
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    return json.results.bindings
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}
