export const METADATA_CORRECTION_AUDIT_GRAPH = 'https://gcmd.earthdata.nasa.gov/kms/audit/metadata-corrections'
export const METADATA_CORRECTION_AUDIT_RECORD_BASE_URI = 'https://gcmd.earthdata.nasa.gov/kms/metadata-correction-audit/'

export const escapeSparqlLiteral = (value) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')

export const createMetadataCorrectionAuditRecordUri = (recordId) => (
  `${METADATA_CORRECTION_AUDIT_RECORD_BASE_URI}${recordId}`
)

export default {
  METADATA_CORRECTION_AUDIT_GRAPH,
  METADATA_CORRECTION_AUDIT_RECORD_BASE_URI,
  escapeSparqlLiteral,
  createMetadataCorrectionAuditRecordUri
}
