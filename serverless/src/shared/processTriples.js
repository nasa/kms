/**
 * Processes SPARQL result bindings to organize and categorize the data.
 *
 * @param {Array} bindings - An array of binding objects from SPARQL results.
 *                           Each binding is expected to have 's', 'p', and 'o' properties,
 *                           each of which is an object with 'type' and 'value' properties.
 *                           It may also contain 'bn', 'bp', and 'bo' properties for blank nodes.
 *
 * @returns {Object} An object containing:
 *   - bNodeMap: A map of blank node identifiers to their associated triples.
 *   - nodes: A map of subject URIs to their associated triples.
 *   - conceptURIs: An array of URIs identified as concepts (having a skos:prefLabel).
 *
 * @description
 * This function performs the following operations:
 * 1. Deduplicates triples using a string representation for uniqueness checking.
 * 2. Organizes regular triples by subject URI in the 'nodes' object.
 * 3. Processes blank nodes separately, storing them in the 'bNodeMap'.
 * 4. Identifies concept URIs based on the presence of a skos:prefLabel predicate.
 *
 * @example
 * const bindings = [
 *   { s: { type: 'uri', value: 'http://example.com/concept1' },
 *     p: { type: 'uri', value: 'http://www.w3.org/2004/02/skos/core#prefLabel' },
 *     o: { type: 'literal', value: 'Concept 1' } },
 *   { s: { type: 'uri', value: 'http://example.com/concept1' },
 *     p: { type: 'uri', value: 'http://example.com/property' },
 *     o: { type: 'bnode', value: 'b0' } },
 *   { bn: { type: 'bnode', value: 'b0' },
 *     bp: { type: 'uri', value: 'http://example.com/bnodeProperty' },
 *     bo: { type: 'literal', value: 'Bnode value' } }
 * ];
 *
 * const result = processTriples(bindings);
 * console.log(result);
 * // Output will be an object with bNodeMap, nodes, and conceptURIs
 */
export const processTriples = (bindings) => {
  const bNodeMap = {}
  const nodes = {}
  const conceptURIs = new Set()
  const uniqTriple = {}

  const tripleToString = (triple) => `${triple.s.value}|${triple.p.value}|${triple.o.value}`

  const isUnique = (triple) => {
    const tripleString = tripleToString(triple)
    if (uniqTriple[tripleString]) {
      return false
    }

    uniqTriple[tripleString] = true

    return true
  }

  // Process for blank nodes
  const processBNode = (key, s, p, o) => {
    if (!bNodeMap[key]) {
      bNodeMap[key] = []
    }

    bNodeMap[key].push({
      s,
      p,
      o
    })
  }

  bindings.forEach((binding) => {
    const subject = binding.s.value
    const predicate = binding.p.value

    // Process for nodes
    if (!nodes[subject]) nodes[subject] = []
    if (nodes[subject]) {
      if (isUnique(binding)) {
        nodes[subject].push({
          s: binding.s,
          p: binding.p,
          o: binding.o
        })
      }
    }

    // Process for blank nodes
    // Two different ways they can come in, from ?bn ?bp ?bo
    // Or as ?s ?p ?o where ?s.type === 'bnode'
    if (binding.bn) {
      processBNode(binding.bn.value, binding.bn, binding.bp, binding.bo)
    } else if (binding.s.type === 'bnode') {
      processBNode(binding.s.value, binding.s, binding.p, binding.o)
    }

    // Identify concepts
    if (predicate === 'http://www.w3.org/2004/02/skos/core#prefLabel') {
      conceptURIs.add(subject)
    }
  })

  return {
    bNodeMap,
    nodes,
    conceptURIs: Array.from(conceptURIs)
  }
}
