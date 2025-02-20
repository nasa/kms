/* eslint-disable arrow-body-style */

const prefixes = {
  'http://www.w3.org/2004/02/skos/core#': 'skos:',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf:',
  'https://gcmd.earthdata.nasa.gov/kms#': 'gcmd:',
  'http://purl.org/dc/terms/': 'dcterms:'

}

/**
 * Replaces full URI prefixes with their shorter namespace aliases in a given predicate.
 *
 * This function takes a predicate (typically a full URI) and replaces known URI prefixes
 * with their corresponding shorter aliases. It's useful for making URIs more readable
 * and consistent with common RDF notation.
 *
 * The function uses a predefined map of URI prefixes to their aliases:
 * - http://www.w3.org/2004/02/skos/core# -> skos:
 * - http://www.w3.org/1999/02/22-rdf-syntax-ns# -> rdf:
 * - https://gcmd.earthdata.nasa.gov/kms# -> gcmd:
 *
 * @param {string} predicate - The full URI predicate to be shortened.
 *
 * @returns {string} The predicate with any matching prefixes replaced by their aliases.
 *                   If no matches are found, the original predicate is returned unchanged.
 *
 * @example
 * prefixNode('http://www.w3.org/2004/02/skos/core#broader')
 * // Returns: 'skos:broader'
 *
 * prefixNode('http://example.com/unknown')
 * // Returns: 'http://example.com/unknown' (unchanged)
 */

const prefixNode = (predicate) => {
  return Object.entries(prefixes).reduce((acc, [prefix, replacement]) => {
    return acc.replace(prefix, replacement)
  }, predicate)
}

export default prefixNode
