import { createTwoFilesPatch } from 'diff'

const MAX_METADATA_DIFF_CHARACTERS = 250_000

/**
 * Converts native XML or JSON metadata into comparable text without changing the write payload.
 *
 * @example
 * snapshotNativeMetadataForDiff({ ShortName: 'GOSAT' })
 * // '{\n  "ShortName": "GOSAT"\n}'
 *
 * @param {string|Object} metadata Native metadata payload.
 * @returns {string|undefined} Text representation, or undefined when it cannot be serialized.
 */
export const snapshotNativeMetadataForDiff = (metadata) => {
  if (typeof metadata === 'string') return metadata

  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return undefined
  }
}

/**
 * Builds a bounded unified diff between the metadata fetched from CMR and the corrected payload.
 *
 * @example
 * buildNativeMetadataDiff({
 *   originalMetadata: '<Platform>GOSAT</Platform>',
 *   correctedMetadata: '<Platform>GOSAT - Test1</Platform>',
 *   priorRevisionId: 3
 * })
 * // { changed: true, format: 'unified', patch: '...', truncated: false, ... }
 *
 * @param {Object} params Diff inputs.
 * @param {string|Object} params.originalMetadata Native metadata fetched from CMR.
 * @param {string|Object} params.correctedMetadata Corrected metadata prepared for writeback.
 * @param {number|string} [params.priorRevisionId] CMR revision represented by the original payload.
 * @returns {Object|undefined} Bounded display diff, or undefined for unserializable metadata.
 */
export const buildNativeMetadataDiff = ({
  originalMetadata,
  correctedMetadata,
  priorRevisionId
}) => {
  const originalText = snapshotNativeMetadataForDiff(originalMetadata)
  const correctedText = snapshotNativeMetadataForDiff(correctedMetadata)

  if (typeof originalText !== 'string' || typeof correctedText !== 'string') {
    return undefined
  }

  const changed = originalText !== correctedText
  const fullPatch = changed
    ? createTwoFilesPatch(
      `cmr-revision-${priorRevisionId ?? 'unknown'}`,
      'corrected-metadata',
      originalText,
      correctedText,
      '',
      '',
      { context: 3 }
    )
    : ''
  const truncated = fullPatch.length > MAX_METADATA_DIFF_CHARACTERS
  const patch = truncated
    ? fullPatch.slice(0, MAX_METADATA_DIFF_CHARACTERS)
    : fullPatch

  return {
    changed,
    format: 'unified',
    patch,
    truncated,
    originalBytes: Buffer.byteLength(originalText, 'utf8'),
    correctedBytes: Buffer.byteLength(correctedText, 'utf8')
  }
}

export default buildNativeMetadataDiff
