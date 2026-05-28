/**
 * Stub ECHO10 delegate for KMS-675.
 *
 * Real ECHO10 mutation is follow-on work. For now this delegate only records the handoff shape.
 */
export const applyEcho10MetadataCorrections = async ({
  collectionConceptId,
  providerId,
  nativeId,
  metadataPayload,
  corrections = []
}) => ({
  nativeFormat: 'ECHO10',
  delegateName: 'echo10',
  collectionConceptId,
  providerId,
  nativeId,
  correctionCount: corrections.length,
  correctedMetadata: metadataPayload,
  correctionsApplied: corrections,
  stubbed: true
})

export default applyEcho10MetadataCorrections
