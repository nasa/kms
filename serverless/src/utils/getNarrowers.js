/**
 * Retrieves narrower concepts for a given URI from a map of triples.
 * @param {string} uri - The URI of the concept to find narrowers for.
 * @param {Object} map - A map containing triples for various URIs.
 * @returns {Array} An array of narrower concepts with their labels and URIs.
 */
const getNarrowers = (uri, map) => {
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

// Export the getNarrowers function as the default export
export default getNarrowers
