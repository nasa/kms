const getNarrowers = (uri, map) => {
  const triples = map[uri] || []

  const results = triples.map((item) => {
    const { prefLabel, narrower, narrowerPrefLabel } = item

    return {
      prefLabel: prefLabel?.value,
      narrowerPrefLabel: narrowerPrefLabel?.value,
      uri: narrower?.value
    }
  })

  return results
}

export default getNarrowers
