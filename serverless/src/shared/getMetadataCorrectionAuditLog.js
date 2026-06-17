import {
  escapeSparqlLiteral,
  METADATA_CORRECTION_AUDIT_GRAPH
} from '@/shared/metadataCorrectionAudit'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Normalizes a query-string boolean flag.
 *
 * @param {unknown} value - Raw query-string value.
 * @returns {boolean} True when the caller explicitly enabled the flag.
 */
const normalizeBoolean = (value) => ['1', 'true', 'yes'].includes(
  String(value || '').toLowerCase()
)

const normalizeLimit = (limit) => {
  const parsed = Number.parseInt(limit, 10)

  if (Number.isNaN(parsed)) {
    return 100
  }

  return Math.max(1, Math.min(parsed, 500))
}

/**
 * Builds a stable collapse key for one logical correction row.
 *
 * The append-only audit writer persists separate `pending` and `applied` rows for the same
 * logical correction. This key intentionally ignores row-specific fields like `recordUri`,
 * `timestamp`, and `status` so the read path can collapse those lifecycle rows into the newest
 * effective state when requested.
 *
 * @param {object} item - Normalized audit row.
 * @returns {string} Stable key used to identify duplicate lifecycle rows.
 */
const buildCollapsedAuditKey = (item) => JSON.stringify([
  item.publishedVersionName,
  item.collectionConceptId,
  item.keywordConceptUuid,
  item.scheme,
  item.action,
  item.oldKeywordPath,
  item.newKeywordPath,
  item.nativeFormat,
  item.delegateName,
  item.triggerScheme,
  item.triggerKeywordUuid
])

/**
 * Collapses append-only lifecycle rows into a latest-only view.
 *
 * The SPARQL query already returns rows newest-first, so keeping the first row for each
 * correction key preserves the most recent status while hiding older duplicate lifecycle rows.
 *
 * @param {Array<object>} items - Normalized audit rows ordered newest-first.
 * @returns {Array<object>} Collapsed audit rows.
 */
const collapseAuditRows = (items) => {
  const seenKeys = new Set()

  return items.filter((item) => {
    const collapseKey = buildCollapsedAuditKey(item)

    if (seenKeys.has(collapseKey)) {
      return false
    }

    seenKeys.add(collapseKey)

    return true
  })
}

/**
 * Reads metadata-correction audit rows from the dedicated RDF4J audit graph.
 *
 * This helper is the read-side pair to `persistMetadataCorrectionAuditLog`. It builds a SPARQL
 * query against the dedicated audit graph, applies any optional filters the caller supplied, and
 * returns a normalized array of audit records ordered newest-first.
 *
 * The returned rows describe resolved metadata corrections, not raw keyword events. Each row
 * represents one correction the service decided to apply (or mark pending), including the
 * collection it targeted, the resolved keyword UUID/path information, the delegate/native format
 * used, and the triggering event metadata when present.
 *
 * These audit rows expose the canonical UUID plus the derived human-readable keyword paths.
 * Keyword objects themselves are intentionally not stored in the audit graph.
 *
 * @param {object} [filters={}] - Optional query filters.
 * @param {string} [filters.collectionConceptId] - Filter by collection concept id.
 * @param {string} [filters.keywordConceptUuid] - Filter by resolved keyword UUID.
 * @param {string} [filters.action] - Filter by triggering event action.
 * @param {string} [filters.scheme] - Filter by corrected keyword scheme.
 * @param {string} [filters.status] - Filter by audit status.
 * @param {string|boolean} [filters.latestOnly=false] - When truthy, collapses duplicate
 * append-only lifecycle rows so only the newest row for each logical correction is returned.
 * @param {string|number} [filters.limit=100] - Maximum number of rows to return. Values are
 * normalized into the inclusive range `1..500`, with invalid values falling back to `100`.
 * @returns {Promise<Array<{
 *   recordUri: string | undefined,
 *   timestamp: string | undefined,
 *   publishedVersionName: string | undefined,
 *   collectionConceptId: string | undefined,
 *   keywordConceptUuid: string | undefined,
 *   scheme: string | undefined,
 *   action: string | undefined,
 *   oldKeywordPath?: string | undefined,
 *   newKeywordPath?: string | undefined,
 *   nativeFormat: string | undefined,
 *   delegateName: string | undefined,
 *   status: string | undefined,
 *   triggerScheme: string | undefined,
 *   triggerKeywordUuid: string | undefined
 * }>>} Audit log rows ordered newest-first.
 */
export const getMetadataCorrectionAuditLog = async (filters = {}) => {
  const {
    collectionConceptId,
    keywordConceptUuid,
    action,
    scheme,
    status,
    latestOnly = false,
    limit = 100
  } = filters

  const filterClauses = [
    collectionConceptId ? `FILTER(?collectionConceptId = "${escapeSparqlLiteral(collectionConceptId)}")` : '',
    keywordConceptUuid ? `FILTER(?keywordConceptUuid = "${escapeSparqlLiteral(keywordConceptUuid)}")` : '',
    action ? `FILTER(?action = "${escapeSparqlLiteral(action)}")` : '',
    scheme ? `FILTER(?scheme = "${escapeSparqlLiteral(scheme)}")` : '',
    status ? `FILTER(?status = "${escapeSparqlLiteral(status)}")` : ''
  ].filter(Boolean).join('\n      ')

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT
      ?record
      ?timestamp
      ?publishedVersionName
      ?collectionConceptId
      ?keywordConceptUuid
      ?scheme
      ?action
      ?oldKeywordPath
      ?newKeywordPath
      ?nativeFormat
      ?delegateName
      ?status
      ?triggerScheme
      ?triggerKeywordUuid
    WHERE {
      GRAPH <${METADATA_CORRECTION_AUDIT_GRAPH}> {
        ?record a gcmd:MetadataCorrectionAuditRecord ;
                dcterms:created ?timestamp ;
                gcmd:publishedVersionName ?publishedVersionName ;
                gcmd:collectionConceptId ?collectionConceptId ;
                gcmd:keywordConceptUuid ?keywordConceptUuid ;
                gcmd:scheme ?scheme ;
                gcmd:action ?action ;
                gcmd:nativeFormat ?nativeFormat ;
                gcmd:delegateName ?delegateName ;
                gcmd:status ?status .
        OPTIONAL { ?record gcmd:oldKeywordPath ?oldKeywordPath }
        OPTIONAL { ?record gcmd:newKeywordPath ?newKeywordPath }
        OPTIONAL { ?record gcmd:triggerScheme ?triggerScheme }
        OPTIONAL { ?record gcmd:triggerKeywordUuid ?triggerKeywordUuid }
      }
      ${filterClauses}
    }
    ORDER BY DESC(?timestamp)
    LIMIT ${normalizeLimit(limit)}
  `

  const response = await sparqlRequest({
    method: 'POST',
    body: query,
    contentType: 'application/sparql-query',
    accept: 'application/sparql-results+json'
  })

  const result = await response.json()
  const bindings = result?.results?.bindings || []
  const items = bindings.map((binding) => ({
    recordUri: binding.record?.value,
    timestamp: binding.timestamp?.value,
    publishedVersionName: binding.publishedVersionName?.value,
    collectionConceptId: binding.collectionConceptId?.value,
    keywordConceptUuid: binding.keywordConceptUuid?.value,
    scheme: binding.scheme?.value,
    action: binding.action?.value,
    oldKeywordPath: binding.oldKeywordPath?.value,
    newKeywordPath: binding.newKeywordPath?.value,
    nativeFormat: binding.nativeFormat?.value,
    delegateName: binding.delegateName?.value,
    status: binding.status?.value,
    triggerScheme: binding.triggerScheme?.value,
    triggerKeywordUuid: binding.triggerKeywordUuid?.value
  }))

  return normalizeBoolean(latestOnly)
    ? collapseAuditRows(items)
    : items
}

export default getMetadataCorrectionAuditLog
