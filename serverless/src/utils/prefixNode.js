/* eslint-disable arrow-body-style */
const prefixes = {
  'http://www.w3.org/2004/02/skos/core#': 'skos:',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf:',
  'https://gcmd.earthdata.nasa.gov/kms#': 'gcmd:'
}

const prefixNode = (predicate) => {
  return Object.entries(prefixes).reduce((acc, [prefix, replacement]) => {
    return acc.replace(prefix, replacement)
  }, predicate)
}

export default prefixNode
