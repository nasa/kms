import { Parser } from '@traqula/parser-sparql-1-1'

const SERVICE_KEYWORD = /\bSERVICE\b/i

/**
 * Recursively searches a Traqula AST for a federated SERVICE pattern.
 *
 * @param {unknown} node Current AST value.
 * @returns {boolean} True when this value contains a SERVICE pattern.
 */
const containsServicePattern = (node) => {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some(containsServicePattern)
  if (node.type === 'pattern' && node.subType === 'service') return true

  return Object.values(node).some(containsServicePattern)
}

/**
 * Determines whether executable SPARQL contains a federated SERVICE clause.
 * A parse failure containing the SERVICE keyword is rejected fail-closed.
 *
 * @example
 * containsSparqlServiceClause('SELECT * WHERE { SERVICE <https://example.com> {} }') // true
 * containsSparqlServiceClause('SELECT * WHERE { BIND("Customer Service" AS ?label) }') // false
 *
 * @param {unknown} sparql SPARQL query or update text.
 * @returns {boolean} True when a SERVICE clause may be present.
 */
export const containsSparqlServiceClause = (sparql) => {
  if (typeof sparql !== 'string' || !SERVICE_KEYWORD.test(sparql)) return false

  try {
    const abstractSyntaxTree = new Parser().parse(sparql)

    return containsServicePattern(abstractSyntaxTree)
  } catch {
    return true
  }
}
