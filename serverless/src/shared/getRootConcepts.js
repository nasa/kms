import { getRootConceptsQuery } from '@/shared/operations/queries/getRootConceptsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves all triples for root SKOS concepts (concepts without a broader concept) for a specific version.
 *
 * @async
 * @function getRootConcepts
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects for root concepts.
 * @throws {Error} If there's an error during the SPARQL request or processing of the response.
 *
 * @example
 * // Fetch root concepts from the published version
 * try {
 *   const rootConcepts = await getRootConcepts('published');
 *   console.log(rootConcepts);
 *   // Example output:
 *   // [
 *   //   {
 *   //     subject: { value: "https://gcmd.earthdata.nasa.gov/kms/concepts/1234" },
 *   //     predicate: { value: "http://www.w3.org/2004/02/skos/core#prefLabel" },
 *   //     object: { value: "EARTH SCIENCE" }
 *   //   },
 *   //   // ... more triples
 *   // ]
 * } catch (error) {
 *   console.error('Failed to fetch root concepts:', error);
 * }
 *
 * @example
 * // Fetch root concepts from the draft version
 * try {
 *   const rootConcepts = await getRootConcepts('draft');
 *   console.log(rootConcepts);
 * } catch (error) {
 *   console.error('Failed to fetch root concepts:', error);
 * }
 *
 * @see Related functions:
 * {@link getRootConceptsQuery}
 * {@link sparqlRequest}
 */
export const getRootConcepts = async (version) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getRootConceptsQuery(),
      version,
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '8000', 10)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    return result.results.bindings
  } catch (error) {
    console.error('Error fetching root concepts:', error)
    throw error
  }
}
