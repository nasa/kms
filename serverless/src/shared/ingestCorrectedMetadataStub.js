/**
 * Stub ingest handoff for KMS-675.
 *
 * Real CMR write-back is follow-on work. For now this helper records that ingest
 * would happen after delegate completion.
 */
export const ingestCorrectedMetadataStub = async ({
  collectionConceptId,
  nativeFormat,
  correctionCount
}) => ({
  collectionConceptId,
  nativeFormat,
  correctionCount,
  ingested: false,
  stubbed: true
})

export default ingestCorrectedMetadataStub
