/**
 * Processes an array of RDF triples to organize and categorize the data.
 *
 * This function takes an array of RDF triples and performs the following operations:
 * 1. Creates a map of blank nodes (bNodes) and their associated triples.
 * 2. Organizes triples by their subject URI.
 * 3. Identifies and collects URIs of concepts based on the presence of a skos:prefLabel predicate.
 *
 * @param {Array} triples - An array of RDF triple objects. Each triple is expected to have
 *                          's' (subject), 'p' (predicate), and 'o' (object) properties.
 *
 * @returns {Object} An object containing:
 *   - bNodeMap: A map of blank node identifiers to their associated triples.
 *   - nodes: A map of subject URIs to their associated triples.
 *   - conceptURIs: An array of URIs identified as concepts (having a skos:prefLabel).
 *
 * This processed data structure allows for efficient lookup and manipulation of the RDF data,
 * particularly useful for operations involving blank nodes, subject-based grouping,
 * and concept identification.
 */
const processTriples = (triples) => {
  const bNodeMap = {}
  const nodes = {}
  const conceptURIs = []

  triples.forEach((triple) => {
    const uri = triple.s.value
    if (!nodes[uri]) nodes[uri] = []
    nodes[uri].push(triple)

    if (triple.s.type === 'bnode') {
      if (!bNodeMap[triple.s.value]) {
        bNodeMap[triple.s.value] = []
      }

      bNodeMap[triple.s.value].push(triple)
    }

    if (triple.p.value === 'http://www.w3.org/2004/02/skos/core#prefLabel') {
      conceptURIs.push(uri)
    }
  })

  return {
    bNodeMap,
    nodes,
    conceptURIs
  }
}

export default processTriples
