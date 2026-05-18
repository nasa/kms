/**
 * Applies Vertical Resolution Range corrections directly to the parsedMetadata object.
 * Path: DIF.Data_Resolution.Vertical_Resolution_Range
 */
export const applyVerticalResolutionRangeCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index (e.g., ['VerticalResolutionRanges', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  // Navigate to parent container
  const resolution = parsedMetadata?.DIF?.Data_Resolution
  if (!resolution) return false

  const targetField = 'Vertical_Resolution_Range'
  const ranges = resolution[targetField]
  if (!ranges) return false

  if (action === 'delete') {
    if (Array.isArray(ranges)) {
      ranges.splice(index, 1)
      if (ranges.length === 0) {
        delete resolution[targetField]
      }
    } else if (index === 0) {
      delete resolution[targetField]
    }

    // Cleanup: If Data_Resolution is now empty, remove it to keep XML valid
    if (Object.keys(resolution).length === 0) {
      // eslint-disable-next-line no-param-reassign
      delete parsedMetadata.DIF.Data_Resolution
    }

    return true
  }

  if (action === 'replace') {
    const newVal = correction.newKeywordPath

    if (Array.isArray(ranges)) {
      if (index >= 0 && index < ranges.length) {
        ranges[index] = newVal

        return true
      }
    } else if (index === 0) {
      resolution[targetField] = newVal

      return true
    }
  }

  return false
}
