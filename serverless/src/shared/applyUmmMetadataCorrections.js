/**
 * Stub UMM delegate for KMS-675.
 *
 * Real UMM mutation is follow-on work. For now this delegate only records the handoff shape.
 */
export const applyUmmMetadataCorrections = async ({
  collectionConceptId,
  providerId,
  nativeId,
  metadataPayload,
  corrections = []
}) => ({
  nativeFormat: 'UMM',
  delegateName: 'umm',
  collectionConceptId,
  providerId,
  nativeId,
  correctionCount: corrections.length,
  correctedMetadata: metadataPayload,
  correctionsApplied: corrections,
  stubbed: true
})

export default applyUmmMetadataCorrections
