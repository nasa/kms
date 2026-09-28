import { Parser } from '@traqula/parser-sparql-1-1'

const KMS_VERSION_GRAPH_IRI_PREFIX = 'https://gcmd.earthdata.nasa.gov/kms/version/'
const REMOTE_OPERATION_KEYWORD = /\b(?:FROM|LOAD|SERVICE)\b/i
const UNICODE_ESCAPE = /\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/g

/**
 * Expands SPARQL Unicode escapes before checking for operation keywords.
 * The original request is still parsed so escapes inside literals remain harmless.
 *
 * @param {string} sparql SPARQL request text.
 * @returns {string} Text with Unicode escape sequences expanded.
 */
const expandUnicodeEscapes = (sparql) => sparql.replace(
  UNICODE_ESCAPE,
  (match, shortCodePoint, longCodePoint) => {
    const codePoint = Number.parseInt(shortCodePoint || longCodePoint, 16)

    try {
      return String.fromCodePoint(codePoint)
    } catch {
      return match
    }
  }
)

/**
 * Determines whether a dataset clause is limited to a KMS version graph.
 * KMS does not use named datasets, so FROM NAMED is rejected.
 *
 * @param {unknown} clause Parsed SPARQL dataset clause.
 * @returns {boolean} True when the clause is safe for KMS queries.
 */
const isAllowedDatasetClause = (clause) => (
  clause?.clauseType === 'default'
  && clause?.value?.subType === 'namedNode'
  && clause.value.value.startsWith(KMS_VERSION_GRAPH_IRI_PREFIX)
)

/**
 * Recursively searches a Traqula AST for operations that can access remote data.
 *
 * @param {unknown} node Current AST value.
 * @returns {boolean} True when this value contains a disallowed operation.
 */
const containsDisallowedOperation = (node) => {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some(containsDisallowedOperation)
  if (node.type === 'pattern' && node.subType === 'service') return true
  if (node.type === 'updateOperation' && node.subType === 'load') return true
  if (node.type === 'datasetClauses') {
    return node.clauses.some((clause) => !isAllowedDatasetClause(clause))
  }

  return Object.values(node).some(containsDisallowedOperation)
}

/**
 * Determines whether SPARQL uses a remote-data operation KMS does not use. Relevant Unicode
 * escapes are expanded for detection, and candidate requests are parsed to avoid matching text
 * in literals, comments, or IRIs. Parse failures containing a candidate keyword fail closed.
 *
 * @example
 * isDisallowedSparqlRequest(
 *   'SELECT * WHERE { SERVICE <https://example.com> {} }'
 * ) // true
 * isDisallowedSparqlRequest(
 *   'SELECT * FROM <https://gcmd.earthdata.nasa.gov/kms/version/published> WHERE {}'
 * ) // false
 *
 * @param {unknown} sparql SPARQL query or update text.
 * @returns {boolean} True when the request contains or may contain a disallowed operation.
 */
export const isDisallowedSparqlRequest = (sparql) => {
  if (
    typeof sparql !== 'string'
    || !REMOTE_OPERATION_KEYWORD.test(expandUnicodeEscapes(sparql))
  ) return false

  try {
    const abstractSyntaxTree = new Parser().parse(sparql)

    return containsDisallowedOperation(abstractSyntaxTree)
  } catch {
    return true
  }
}
