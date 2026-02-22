/**
 * @file getNarrowersMap.js
 * @description This module provides functionality to fetch and organize narrower concepts from a SPARQL endpoint for a specific version.
 */

// Import necessary functions and modules
import { getNarrowerConceptsQuery } from '@/shared/operations/queries/getNarrowerConceptsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Fetches narrower concepts for a given scheme and version, organizing them into a map.
 *
 * @async
 * @function getNarrowersMap
 * @param {string} [scheme] - The scheme URI for which to fetch narrower concepts. If not provided, fetches for all schemes.
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Object>} A promise that resolves to a map of narrower concepts.
 * @throws {Error} If there's an error during the SPARQL request or data processing.
 *
 * @example
 * // Fetch narrower concepts for a specific scheme in the published version
 * const scheme = 'http://example.com/scheme/123';
 * try {
 *   const narrowersMap = await getNarrowersMap(scheme, 'published');
 *   console.log(narrowersMap);
 *   // Output: {
 *   //   'http://example.com/concept/1': [
 *   //     { subject: { value: 'http://example.com/concept/1' }, predicate: { value: 'http://www.w3.org/2004/02/skos/core#narrower' }, object: { value: 'http://example.com/concept/2' } },
 *   //     { subject: { value: 'http://example.com/concept/1' }, predicate: { value: 'http://www.w3.org/2004/02/skos/core#narrower' }, object: { value: 'http://example.com/concept/3' } }
 *   //   ],
 *   //   'http://example.com/concept/2': [
 *   //     { subject: { value: 'http://example.com/concept/2' }, predicate: { value: 'http://www.w3.org/2004/02/skos/core#narrower' }, object: { value: 'http://example.com/concept/4' } }
 *   //   ]
 *   // }
 * } catch (error) {
 *   console.error('Error:', error);
 * }
 *
 * @example
 * // Fetch narrower concepts for all schemes in the draft version
 * try {
 *   const narrowersMap = await getNarrowersMap(null, 'draft');
 *   console.log(narrowersMap);
 * } catch (error) {
 *   console.error('Error:', error);
 * }
 *
 * @see Related functions:
 * {@link getNarrowerConceptsQuery}
 * {@link sparqlRequest}
 */
export const getNarrowersMap = async (scheme, version) => {
  try {
    // Make a SPARQL request to fetch narrower concepts
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getNarrowerConceptsQuery(scheme),
      version,
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '8000', 10)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings
    const map = {}

    // Iterate through the triples and build the map
    triples.forEach((triple) => {
      // If the subject doesn't exist in the map, initialize it with an empty array
      if (!map[triple.subject.value]) {
        map[triple.subject.value] = []
      }

      // Add the triple to the array associated with its subject
      map[triple.subject.value].push(triple)
    })

    // Return the constructed map
    return map
  } catch (error) {
    // Log and re-throw any errors that occur during the process
    console.error('Error fetching triples:', error)
    throw error
  }
}
