/**
 * Shared constants and helpers for metadata-correction audit records.
 *
 * The metadata-correction pipeline stores one RDF audit record per resolved correction in a dedicated
 * RDF4J graph. This module centralizes the graph URI, the record URI base, and the tiny helper
 * functions used by both the audit-write and audit-read paths so they stay aligned.
 */
export const METADATA_CORRECTION_AUDIT_GRAPH = 'https://gcmd.earthdata.nasa.gov/kms/audit/metadata-corrections'
export const METADATA_CORRECTION_AUDIT_RECORD_BASE_URI = 'https://gcmd.earthdata.nasa.gov/kms/metadata-correction-audit/'

/**
 * Escapes a string so it can be safely embedded as a SPARQL string literal.
 *
 * @param {unknown} value - Value to serialize into a SPARQL-safe string literal.
 * @returns {string} Escaped literal text.
 */
export const escapeSparqlLiteral = (value) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')

/**
 * Builds the canonical audit record URI for one metadata-correction audit row.
 *
 * @param {string} recordId - Unique identifier for the audit record.
 * @returns {string} Fully qualified audit record URI.
 */
export const createMetadataCorrectionAuditRecordUri = (recordId) => (
  `${METADATA_CORRECTION_AUDIT_RECORD_BASE_URI}${recordId}`
)

export default {
  METADATA_CORRECTION_AUDIT_GRAPH,
  METADATA_CORRECTION_AUDIT_RECORD_BASE_URI,
  escapeSparqlLiteral,
  createMetadataCorrectionAuditRecordUri
}
