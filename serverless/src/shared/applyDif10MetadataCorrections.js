/**
 * Stub DIF10 delegate for KMS-675.
 *
 * Real DIF10 mutation is follow-on work. For now this delegate only records the handoff shape.
 */
export const applyDif10MetadataCorrections = async ({
  collectionConceptId,
  providerId,
  nativeId,
  metadataPayload,
  corrections = []
}) => ({
  nativeFormat: 'DIF10',
  delegateName: 'dif10',
  collectionConceptId,
  providerId,
  nativeId,
  correctionCount: corrections.length,
  correctedMetadata: metadataPayload,
  correctionsApplied: corrections,
  stubbed: true
})

export default applyDif10MetadataCorrections
