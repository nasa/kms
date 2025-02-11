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
