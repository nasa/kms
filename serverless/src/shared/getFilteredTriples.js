import {
  getTriplesForConceptSchemeOrPatternQuery
} from '@/shared/operations/queries/getTriplesForConceptSchemeOrPatternQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves all triples from the configured SPARQL endpoint.   This function will
 * eventually be passed a filter to limit the triples returned.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query to fetch all triples in the database given the specified filter (filter work tbd)
 * 2. Sends a request to the SPARQL endpoint using sparqlRequest.
 * 3. Processes and returns the SPARQL query results.
 *
 * The SPARQL query used is a simple SELECT that retrieves all distinct subject-predicate-object triples.
 *
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects.
 *                           Each triple object contains 's' (subject), 'p' (predicate), and 'o' (object) properties.
 *
 * @throws {Error} If the HTTP request fails, if the response is not ok,
 *                 or if there's any error during the fetching or processing of the triples.
 *
 * @example
 * try {
 *   const triples = await getFilteredTriples();
 *   console.log(triples);
 * } catch (error) {
 *   console.error('Failed to get triples:', error);
 * }
 *
 * @see getApplicationConfig - Used to retrieve the SPARQL endpoint URL.
 * @see sparqlRequest - Used to make the SPARQL query request.
 */

export const getFilteredTriples = async ({ conceptScheme, pattern }) => {
  try {
    const response = await sparqlRequest({
      type: 'query',
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getTriplesForConceptSchemeOrPatternQuery({
        conceptScheme,
        pattern
      })
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
