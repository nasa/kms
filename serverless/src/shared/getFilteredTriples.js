import { getConceptDetailsQuery } from '@/shared/operations/queries/getConceptDetailsQuery'
import { getConceptUrisQuery } from '@/shared/operations/queries/getConceptUrisQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves filtered triples from the configured SPARQL endpoint for a specific version.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query to fetch concept URIs based on the specified parameters.
 * 2. Sends a request to the SPARQL endpoint to get the concept URIs.
 * 3. Constructs another SPARQL query to fetch details for the retrieved concept URIs.
 * 4. Sends a second request to the SPARQL endpoint to get the concept details.
 * 5. Processes and returns the SPARQL query results.
 *
 * @async
 * @function getFilteredTriples
 * @param {Object} params - The parameters for filtering triples.
 * @param {string} [params.conceptScheme] - The concept scheme to filter by.
 * @param {string} [params.pattern] - The pattern to filter triples by.
 * @param {string} params.version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @param {number} params.pageNum - The page number for pagination.
 * @param {number} params.pageSize - The number of items per page.
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects.
 *                           Each triple object contains 's' (subject), 'p' (predicate), and 'o' (object) properties.
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
 * @see getConceptUrisQuery - Used to generate the SPARQL query for fetching concept URIs.
 * @see getConceptDetailsQuery - Used to generate the SPARQL query for fetching concept details.
 */

export const getFilteredTriples = async ({
  conceptScheme, pattern, version, pageNum, pageSize
}) => {
  const offset = (pageNum - 1) * pageSize

  try {
    // Step 1: Fetch concept URIs
    const uriQuery = getConceptUrisQuery({
      conceptScheme,
      pattern,
      pageSize,
      offset
    })
    const uriResponse = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: uriQuery,
      version
    })

    if (!uriResponse.ok) {
      throw new Error(`HTTP error! status: ${uriResponse.status} query=${uriQuery}`)
    }

    const uriJson = await uriResponse.json()
    const conceptUris = uriJson.results.bindings.map((binding) => binding.s.value)

    // Step 2: Fetch details for these concepts
    const query = getConceptDetailsQuery(conceptUris)
    const detailsResponse = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: query,
      version
    })

    if (!detailsResponse.ok) {
      throw new Error(`HTTP error! status: ${detailsResponse.status} query=${query}`)
    }

    const detailsJson = await detailsResponse.json()

    return detailsJson.results.bindings
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}
