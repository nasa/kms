import { v4 as uuidv4 } from 'uuid'

import { getVersionMetadata } from '@/shared/getVersionMetadata'
import {
  createMetadataCorrectionAuditRecordUri,
  escapeSparqlLiteral,
  METADATA_CORRECTION_AUDIT_GRAPH
} from '@/shared/metadataCorrectionAudit'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * RDF4J audit-log writer for metadata-correction activity.
 *
 * This module is the write-side counterpart to `getMetadataCorrectionAuditLog`. It takes the
 * resolved corrections produced by the metadata-correction service and appends one RDF audit
 * record per correction into the dedicated metadata-correction audit graph.
 *
 * The audit records are intentionally append-only and correction-centric. That means one keyword
 * event affecting one collection can produce multiple audit rows when several resolved corrections
 * are applied during the same run.
 *
 * The delegate correction contract can now carry optional long-name metadata for some short-name
 * schemes, but the audit log intentionally persists only the canonical UUID/path fields for now.
 */

const optionalLiteralTriple = (subject, predicate, value) => {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  return `      <${subject}> ${predicate} "${escapeSparqlLiteral(value)}" .\n`
}

/**
 * Persists append-only metadata-correction audit rows to a dedicated RDF4J graph.
 *
 * Current behavior defaults each resolved correction to `pending`, but callers can persist
 * `applied` immediately once metadata write-back succeeds.
 *
 * @param {object} params - Audit persistence parameters.
 * @param {string} params.collectionConceptId - CMR collection concept id.
 * @param {{ eventType?: string, scheme?: string, uuid?: string }} [params.keywordEvent={}] - Triggering keyword event.
 * @param {string} params.nativeFormat - Normalized native format used for delegate selection.
 * @param {string} params.delegateName - Delegate name returned by the correction delegate.
 * @param {Array<{
 *   scheme: string,
 *   keywordConceptUuid: string,
 *   oldKeywordPath: string,
 *   newKeywordPath: string
 * }>} params.corrections - Fully resolved corrections to persist. This audit shape is narrower
 * than the delegate handoff shape and intentionally excludes optional long-name fields.
 * @param {string} [params.status='pending'] - Audit lifecycle status.
 * @param {string} [params.timestamp] - ISO timestamp override for tests.
 * @returns {Promise<{ insertedCount: number, publishedVersionName: string, status: string }>}
 * Insert summary for logging/verification.
 */
export const persistMetadataCorrectionAuditLog = async ({
  collectionConceptId,
  keywordEvent = {},
  nativeFormat,
  delegateName,
  corrections = [],
  status = 'pending',
  timestamp
}) => {
  if (!collectionConceptId) {
    throw new Error('Missing collectionConceptId for metadata correction audit persistence')
  }

  if (!nativeFormat) {
    throw new Error('Missing nativeFormat for metadata correction audit persistence')
  }

  if (!delegateName) {
    throw new Error('Missing delegateName for metadata correction audit persistence')
  }

  if (!Array.isArray(corrections) || corrections.length === 0) {
    return {
      insertedCount: 0,
      publishedVersionName: 'published',
      status
    }
  }

  const publishedVersionMetadata = await getVersionMetadata('published')
  const publishedVersionName = publishedVersionMetadata?.versionName || 'published'
  const auditTimestamp = timestamp || new Date().toISOString()

  const triples = corrections.map((correction) => {
    const recordUri = createMetadataCorrectionAuditRecordUri(uuidv4())

    return [
      `      <${recordUri}> a gcmd:MetadataCorrectionAuditRecord .`,
      `      <${recordUri}> dcterms:created "${escapeSparqlLiteral(auditTimestamp)}"^^xsd:dateTime .`,
      `      <${recordUri}> gcmd:publishedVersionName "${escapeSparqlLiteral(publishedVersionName)}" .`,
      `      <${recordUri}> gcmd:collectionConceptId "${escapeSparqlLiteral(collectionConceptId)}" .`,
      `      <${recordUri}> gcmd:keywordConceptUuid "${escapeSparqlLiteral(correction.keywordConceptUuid)}" .`,
      `      <${recordUri}> gcmd:scheme "${escapeSparqlLiteral(correction.scheme)}" .`,
      `      <${recordUri}> gcmd:action "${escapeSparqlLiteral(keywordEvent.eventType || 'UNKNOWN')}" .`,
      `      <${recordUri}> gcmd:oldKeywordPath "${escapeSparqlLiteral(correction.oldKeywordPath)}" .`,
      `      <${recordUri}> gcmd:newKeywordPath "${escapeSparqlLiteral(correction.newKeywordPath)}" .`,
      `      <${recordUri}> gcmd:nativeFormat "${escapeSparqlLiteral(nativeFormat)}" .`,
      `      <${recordUri}> gcmd:delegateName "${escapeSparqlLiteral(delegateName)}" .`,
      `      <${recordUri}> gcmd:status "${escapeSparqlLiteral(status)}" .`,
      optionalLiteralTriple(recordUri, 'gcmd:triggerScheme', keywordEvent.scheme),
      optionalLiteralTriple(recordUri, 'gcmd:triggerKeywordUuid', keywordEvent.uuid)
    ].join('\n')
  }).join('\n')

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    INSERT DATA {
      GRAPH <${METADATA_CORRECTION_AUDIT_GRAPH}> {
${triples}
      }
    }
  `

  await sparqlRequest({
    method: 'POST',
    contentType: 'application/sparql-update',
    accept: 'application/json',
    body: query
  })

  return {
    insertedCount: corrections.length,
    publishedVersionName,
    status
  }
}

export default persistMetadataCorrectionAuditLog
