/**
 * Stub DIF10 delegate for KMS-675.
 *
 * Real DIF10 mutation is follow-on work. For now this delegate only records the handoff shape.
 * The `corrections` array may include optional `oldLongName` / `newLongName` fields when the
 * upstream resolver found them for short-name schemes.
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
