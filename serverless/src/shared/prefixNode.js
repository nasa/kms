import { namespaces } from '@/shared/constants/namespaces'

// Convert namespaces to the format needed for prefixNode
const prefixes = Object.entries(namespaces).reduce((acc, [key, value]) => {
  const prefix = key.replace('@xmlns:', '')
  acc[value] = `${prefix}:`

  return acc
}, {})

/**
 * Replaces full URI prefixes with their shorter namespace aliases in a given predicate.
 *
 * This function takes a predicate (typically a full URI) and replaces known URI prefixes
 * with their corresponding shorter aliases. It's useful for making URIs more readable
 * and consistent with common RDF notation.
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
export const prefixNode = (predicate) => {
  if (!predicate) return predicate // Handle null or undefined input

  // eslint-disable-next-line max-len
  return Object.entries(prefixes).reduce((result, [namespace, prefix]) => result.replace(namespace, prefix), predicate)
}
