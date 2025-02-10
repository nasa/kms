import prefixNode from './prefixNode'
import processTriples from './processTriples'

/* eslint-disable no-param-reassign */
const toSkosJson = (uri, triples, bnodeMap) => {
  if (!bnodeMap) {
    const { bNodeMap: map } = processTriples(triples)
    bnodeMap = map
  }

  const processBnode = (bnodeId) => (bnodeMap[bnodeId] || []).reduce((bnode, { p, o }) => {
    bnode[`@${prefixNode(p.value)}`] = o.value

    return bnode
  }, {})

  const processValue = (triple) => {
    if (triple.o.type === 'bnode') return processBnode(triple.o.value)
    if (triple.o.type === 'uri') return { '@rdf:resource': triple.o.value }

    return {
      _text: triple.o.value,
      ...(triple.o['xml:lang'] && { '@xml:lang': triple.o['xml:lang'] })
    }
  }

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

  return triples.reduce((concept, triple) => {
    if (triple.s.value === uri) {
      const predicate = prefixNode(triple.p.value)
      if (predicate !== 'rdf:type') {
        addValueToConcept(concept, predicate, processValue(triple))
      }
    }

    return concept
  }, { '@rdf:about': uri })
}

export default toSkosJson
