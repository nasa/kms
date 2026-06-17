// Normalize CMR format strings before matching them to internal delegate buckets.
const normalizeFormatString = (format) => String(format || '').trim().toUpperCase()

/**
 * Detects the collection's native metadata format from the CMR format metadata returned by
 * collection search.
 *
 * @param {object} params - Format detection parameters.
 * @param {string} [params.format] - CMR format metadata string.
 * @returns {'UMM'|'ISO19115'|'ISO_SMAP'|'ECHO10'|'DIF9'|'DIF10'|'UNKNOWN'} Normalized native format.
 */
export const detectNativeMetadataFormat = ({
  format
} = {}) => {
  const normalizedFormat = normalizeFormatString(format)

  if (normalizedFormat.includes('UMM')) {
    return 'UMM'
  }

  if (normalizedFormat.includes('ECHO10')) {
    return 'ECHO10'
  }

  if (normalizedFormat.includes('DIF10')) {
    return 'DIF10'
  }

  if (normalizedFormat.includes('DIF9') || normalizedFormat.includes('DIF+XML')) {
    return 'DIF9'
  }

  if (normalizedFormat.includes('ISO:SMAP')) {
    return 'ISO_SMAP'
  }

  if (normalizedFormat.includes('ISO19115')) {
    return 'ISO19115'
  }

  return 'UNKNOWN'
}

export default detectNativeMetadataFormat
