/**
 * Retrieves narrower concepts for a given URI from a map of triples.
 * @param {string} uri - The URI of the concept to find narrowers for.
 * @param {Object} map - A map containing triples for various URIs.
 * @returns {Array} An array of narrower concepts with their labels and URIs.
 *
 * @example
 * // Example 1: Basic usage
 * const map = {
 *   'http://example.com/concept/animal': [
 *     {
 *       prefLabel: { value: 'Animal' },
 *       narrower: { value: 'http://example.com/concept/mammal' },
 *       narrowerPrefLabel: { value: 'Mammal' }
 *     },
 *     {
 *       prefLabel: { value: 'Animal' },
 *       narrower: { value: 'http://example.com/concept/bird' },
 *       narrowerPrefLabel: { value: 'Bird' }
 *     }
 *   ]
 * };
 *
 * const narrowers = getNarrowers('http://example.com/concept/animal', map);
 * console.log(narrowers);
 * // Output:
 * // [
 * //   { prefLabel: 'Animal', narrowerPrefLabel: 'Mammal', uri: 'http://example.com/concept/mammal' },
 * //   { prefLabel: 'Animal', narrowerPrefLabel: 'Bird', uri: 'http://example.com/concept/bird' }
 * // ]
 *
 * @example
 * // Example 2: URI not found in map
 * const emptyMap = {};
 * const noNarrowers = getNarrowers('http://example.com/concept/notfound', emptyMap);
 * console.log(noNarrowers);
 * // Output: []
 *
 * @example
 * // Example 3: Missing properties in triples
 * const incompleteMap = {
 *   'http://example.com/concept/incomplete': [
 *     {
 *       narrower: { value: 'http://example.com/concept/partial' }
 *     }
 *   ]
 * };
 *
 * const incompleteNarrowers = getNarrowers('http://example.com/concept/incomplete', incompleteMap);
 * console.log(incompleteNarrowers);
 * // Output:
 * // [
 * //   { prefLabel: undefined, narrowerPrefLabel: undefined, uri: 'http://example.com/concept/partial' }
 * // ]
 */
export const getNarrowers = (uri, map) => {
  // Get the triples for the given URI, or an empty array if not found
  const triples = map[uri] || []

  // Transform each triple into a simplified object
  const results = triples.map((item) => {
    // Destructure relevant properties from the triple
    const { prefLabel, narrower, narrowerPrefLabel } = item

    // Return an object with the preferred label, narrower preferred label, and URI
    return {
      prefLabel: prefLabel?.value,
      narrowerPrefLabel: narrowerPrefLabel?.value,
      uri: narrower?.value
    }
  })

  // Return the array of transformed narrower concepts
  return results
}
