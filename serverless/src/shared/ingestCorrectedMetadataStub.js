import { persistMockCmrCollectionMetadata } from './persistMockCmrCollectionMetadata'

/**
 * Stub ingest handoff for KMS-675.
 *
 * Real CMR write-back is follow-on work. For now this helper records that ingest
 * would happen after delegate completion and, in local smoke-test mode, can push the
 * corrected metadata into the mock CMR server so later events see the updated state.
 */
export const ingestCorrectedMetadataStub = async ({
  collectionConceptId,
  providerId,
  nativeId,
  nativeFormat,
  correctionCount,
  correctedMetadata,
  validation
}) => {
  if (!correctedMetadata || correctionCount <= 0) {
    return {
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctionCount,
      ingested: false,
      updated: false,
      stubbed: true
    }
  }

  try {
    const writebackResult = await persistMockCmrCollectionMetadata({
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctedMetadata,
      validation
    })

    return {
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctionCount,
      ingested: Boolean(writebackResult?.updated),
      updated: Boolean(writebackResult?.updated),
      revisionId: writebackResult?.revisionId,
      enabled: writebackResult?.enabled,
      stubbed: true
    }
  } catch (error) {
    return {
      collectionConceptId,
      providerId,
      nativeId,
      nativeFormat,
      correctionCount,
      ingested: false,
      updated: false,
      writebackErrorMessage: error.message,
      stubbed: true
    }
  }
}

export default ingestCorrectedMetadataStub
