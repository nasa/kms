/**
 * Stub ISO SMAP delegate for KMS-675.
 *
 * Real ISO SMAP mutation is follow-on work. For now this delegate only records the handoff
 * shape.
 */
export const applyIsoSmapMetadataCorrections = async ({
  collectionConceptId,
  providerId,
  nativeId,
  metadataPayload,
  corrections = []
}) => ({
  nativeFormat: 'ISO_SMAP',
  delegateName: 'iso_smap',
  collectionConceptId,
  providerId,
  nativeId,
  correctionCount: corrections.length,
  correctedMetadata: metadataPayload,
  correctionsApplied: corrections,
  stubbed: true
})

export default applyIsoSmapMetadataCorrections
