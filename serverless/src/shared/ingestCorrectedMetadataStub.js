import { persistMockCmrCollectionMetadata } from './persistMockCmrCollectionMetadata'

/**
 * Stub ingest handoff for KMS-675.
 *
 * Real CMR write-back is follow-on work. For now this helper gives the metadata-correction
 * pipeline a stable "ingest seam" after delegate completion.
 *
 * It is currently called by the collection-scoped metadata-correction service after the selected
 * native-format delegate has produced corrected metadata. That makes this helper the last step in
 * the current correction flow before audit status is finalized.
 *
 * Today that means:
 * - if there is no corrected metadata, report a no-op stub result
 * - if corrected metadata exists, attempt the current writeback path
 * - in local smoke flows, that writeback path updates the mock collection state so later events
 *   can observe the corrected metadata instead of the original fixture
 *
 * In practice, the meaningful writeback behavior today is for local smoke testing. Production-style
 * environments still use this as a seam and status contract, but real external ingest/writeback is
 * still follow-on work.
 *
 * The returned object is intentionally status-oriented so callers can decide whether the
 * correction should be treated as `pending` or `applied` for audit purposes without needing to
 * know how the current stub performed its writeback.
 *
 * @param {object} params - Ingest handoff parameters.
 * @param {string} params.collectionConceptId - Target collection concept id.
 * @param {string} params.providerId - Target collection provider id.
 * @param {string} params.nativeId - Target collection native id.
 * @param {string} params.nativeFormat - Native metadata format selected by the delegate.
 * @param {number} params.correctionCount - Number of corrections applied by the delegate.
 * @param {Record<string, unknown>|undefined} params.correctedMetadata - Delegate-produced corrected metadata payload.
 * @returns {Promise<{
 *   collectionConceptId: string,
 *   providerId: string,
 *   nativeId: string,
 *   nativeFormat: string,
 *   correctionCount: number,
 *   ingested: boolean,
 *   updated: boolean,
 *   revisionId?: number,
 *   enabled?: boolean,
 *   writebackErrorMessage?: string,
 *   stubbed: true
 * }>} Stub ingest status describing whether writeback actually happened.
 */
export const ingestCorrectedMetadataStub = async ({
  collectionConceptId,
  providerId,
  nativeId,
  nativeFormat,
  correctionCount,
  correctedMetadata
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
      correctedMetadata
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
