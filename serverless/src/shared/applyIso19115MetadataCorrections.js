/**
 * Stub ISO 19115 delegate for KMS-675.
 *
 * Real ISO 19115 mutation is follow-on work. For now this delegate only records the handoff
 * shape.
 */
export const applyIso19115MetadataCorrections = async ({
  collectionConceptId,
  providerId,
  nativeId,
  metadataPayload,
  corrections = []
}) => ({
  nativeFormat: 'ISO19115',
  delegateName: 'iso19115',
  collectionConceptId,
  providerId,
  nativeId,
  correctionCount: corrections.length,
  correctedMetadata: metadataPayload,
  correctionsApplied: corrections,
  stubbed: true
})

export default applyIso19115MetadataCorrections
