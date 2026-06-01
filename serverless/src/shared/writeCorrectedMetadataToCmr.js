/**
 * Stubbed CMR write seam for corrected native metadata.
 *
 * The follow-on external ticket will replace this stub with the component that writes the
 * corrected payload back to CMR. For now we preserve the future call shape and return a concise
 * summary so the metadata-correction service can prove the corrected payload is ready for
 * downstream persistence without performing external writes.
 *
 * @param {Object} params Write request details.
 * @param {string} [params.collectionConceptId] Collection concept id being corrected.
 * @param {string} [params.nativeFormat] Native metadata format identifier.
 * @param {string} [params.correctedMetadata] Corrected native metadata payload.
 * @param {number} [params.correctionCount] Number of corrections applied to the payload.
 * @param {Array<Object>} [params.correctionsApplied] Applied correction details.
 * @param {string} [params.source] Upstream source label for telemetry.
 * @returns {Promise<Object>} Stub write summary.
 *
 * @example
 * const result = await writeCorrectedMetadataToCmr({
 *   collectionConceptId: 'C0000000000-KMS',
 *   nativeFormat: 'DIF10',
 *   correctedMetadata: '<DIF><Entry_ID/></DIF>',
 *   correctionCount: 1,
 *   correctionsApplied: [{ scheme: 'sciencekeywords' }],
 *   source: 'metadataCorrectionService'
 * })
 */
export const writeCorrectedMetadataToCmr = async ({
  collectionConceptId = null,
  nativeFormat = null,
  correctedMetadata = '',
  correctionCount = 0,
  correctionsApplied = [],
  source = null
} = {}) => ({
  stubbed: true,
  targetComponent: 'cmr-writeback',
  collectionConceptId,
  nativeFormat,
  correctionCount: Number(correctionCount || 0),
  correctionsAppliedCount: Array.isArray(correctionsApplied) ? correctionsApplied.length : 0,
  correctedMetadataBytes: Buffer.byteLength(correctedMetadata, 'utf8'),
  source
})

export default writeCorrectedMetadataToCmr
