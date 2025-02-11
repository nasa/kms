/* eslint-disable no-param-reassign */
import prefixNode from './prefixNode'
import processTriples from './processTriples'

/**
 * Converts RDF triples to a SKOS JSON representation.
 *
 * @param {string} uri - The URI of the main concept.
 * @param {Array} triples - An array of RDF triples.
 * @param {Object} [bnodeMap] - A map of blank nodes to their associated triples.
 * @returns {Object} A SKOS JSON representation of the concept.
 *
 * @example
 * const uri = 'http://example.com/concept/123';
 * const triples = [
 *   { s: { value: uri }, p: { value: 'http://www.w3.org/2004/02/skos/core#prefLabel' }, o: { value: 'Example Concept' } },
 *   { s: { value: uri }, p: { value: 'http://www.w3.org/2004/02/skos/core#definition' }, o: { value: 'This is an example concept.' } }
 * ];
 * const result = toSkosJson(uri, triples);
 * console.log(result);
 * // Output:
 * // {
 * //   '@rdf:about': 'http://example.com/concept/123',
 * //   'skos:prefLabel': { _text: 'Example Concept' },
 * //   'skos:definition': { _text: 'This is an example concept.' }
 * // }
 */
const toSkosJson = (uri, triples, bnodeMap) => {
  // If bnodeMap is not provided, process the triples to create one
  if (!bnodeMap) {
    const { bNodeMap: map } = processTriples(triples)
    bnodeMap = map
  }

  /**
   * Processes a blank node and returns its JSON representation.
   *
   * @param {string} bnodeId - The ID of the blank node.
   * @returns {Object} JSON representation of the blank node.
   *
   * @example
   * const bnodeMap = {
   *   '_:b1': [
   *     { p: { value: 'http://www.w3.org/2004/02/skos/core#broader' }, o: { value: 'http://example.com/concept/456' } }
   *   ]
   * };
   * const result = processBnode('_:b1');
   * console.log(result);
   * // Output: { '@skos:broader': 'http://example.com/concept/456' }
   */
  const processBnode = (bnodeId) => {
    const bnode = {}
    const bnodeTriples = bnodeMap[bnodeId] || []

    bnodeTriples.forEach(({ p, o }) => {
      bnode[`@${prefixNode(p.value)}`] = o.value
    })

    return bnode
  }

  /**
   * Processes the object of a triple and returns its appropriate representation.
   *
   * @param {Object} triple - The RDF triple.
   * @returns {Object|string} The processed value of the triple's object.
   *
   * @example
   * const triple1 = { o: { type: 'bnode', value: '_:b1' } };
   * console.log(processValue(triple1));
   * // Output: { '@skos:broader': 'http://example.com/concept/456' } (assuming the bnode example above)
   *
   * const triple2 = { o: { type: 'uri', value: 'http://example.com/concept/789' } };
   * console.log(processValue(triple2));
   * // Output: { '@rdf:resource': 'http://example.com/concept/789' }
   *
   * const triple3 = { o: { type: 'literal', value: 'Example', 'xml:lang': 'en' } };
   * console.log(processValue(triple3));
   * // Output: { _text: 'Example', '@xml:lang': 'en' }
   */
  const processValue = (triple) => {
    if (triple.o.type === 'bnode') return processBnode(triple.o.value)
    if (triple.o.type === 'uri') return { '@rdf:resource': triple.o.value }

    return {
      _text: triple.o.value,
      ...(triple.o['xml:lang'] && { '@xml:lang': triple.o['xml:lang'] })
    }
  }

  /**
   * Adds a value to a concept, handling cases where the predicate already exists.
   *
   * @param {Object} concept - The concept object being built.
   * @param {string} predicate - The predicate to add the value to.
   * @param {*} value - The value to add.
   *
   * @example
   * const concept = {};
   * addValueToConcept(concept, 'skos:prefLabel', { _text: 'Example' });
   * console.log(concept);
   * // Output: { 'skos:prefLabel': { _text: 'Example' } }
   *
   * addValueToConcept(concept, 'skos:altLabel', { _text: 'Alt Example' });
   * console.log(concept);
   * // Output: { 'skos:prefLabel': { _text: 'Example' }, 'skos:altLabel': { _text: 'Alt Example' } }
   *
   * addValueToConcept(concept, 'skos:altLabel', { _text: 'Another Alt' });
   * console.log(concept);
   * // Output: {
   * //   'skos:prefLabel': { _text: 'Example' },
   * //   'skos:altLabel': [{ _text: 'Alt Example' }, { _text: 'Another Alt' }]
   * // }
   */
  const addValueToConcept = (concept, predicate, value) => {
    if (!concept[predicate]) {
      concept[predicate] = value
    } else if (Array.isArray(concept[predicate])) {
      if (!concept[predicate].some((v) => JSON.stringify(v) === JSON.stringify(value))) {
        concept[predicate].push(value)
      }
    } else if (JSON.stringify(concept[predicate]) !== JSON.stringify(value)) {
      concept[predicate] = [concept[predicate], value]
    }
  }

  const concept = { '@rdf:about': uri }

  triples.forEach((triple) => {
    if (triple.s.value === uri) {
      const predicate = prefixNode(triple.p.value)
      if (predicate !== 'rdf:type') {
        addValueToConcept(concept, predicate, processValue(triple))
      }
    }
  })
}

export default toSkosJson
