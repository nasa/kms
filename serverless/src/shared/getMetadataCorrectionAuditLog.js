import {
  escapeSparqlLiteral,
  METADATA_CORRECTION_AUDIT_GRAPH
} from '@/shared/metadataCorrectionAudit'
import { sparqlRequest } from '@/shared/sparqlRequest'

const normalizeLimit = (limit) => {
  const parsed = Number.parseInt(limit, 10)

  if (Number.isNaN(parsed)) {
    return 100
  }

  return Math.max(1, Math.min(parsed, 500))
}

/**
 * Reads metadata-correction audit rows from the dedicated RDF4J audit graph.
 *
 * @param {object} [filters={}] - Optional query filters.
 * @param {string} [filters.collectionConceptId] - Filter by collection concept id.
 * @param {string} [filters.keywordConceptUuid] - Filter by resolved keyword UUID.
 * @param {string} [filters.action] - Filter by triggering event action.
 * @param {string} [filters.scheme] - Filter by corrected keyword scheme.
 * @param {string} [filters.status] - Filter by audit status.
 * @param {string|number} [filters.limit=100] - Maximum number of rows to return.
 * @returns {Promise<Array<object>>} Audit log rows ordered newest-first.
 */
export const getMetadataCorrectionAuditLog = async (filters = {}) => {
  const {
    collectionConceptId,
    keywordConceptUuid,
    action,
    scheme,
    status,
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
                gcmd:oldKeywordPath ?oldKeywordPath ;
                gcmd:newKeywordPath ?newKeywordPath ;
                gcmd:nativeFormat ?nativeFormat ;
                gcmd:delegateName ?delegateName ;
                gcmd:status ?status .
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

  return bindings.map((binding) => ({
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
}

export default getMetadataCorrectionAuditLog
