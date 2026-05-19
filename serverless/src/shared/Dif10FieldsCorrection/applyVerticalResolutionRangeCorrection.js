/**
 * Applies Vertical Resolution Range corrections directly to the parsedMetadata object via value-based lookup.
 * Path: DIF.Data_Resolution.Vertical_Resolution_Range
 */
export const applyVerticalResolutionRangeCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()

  // Navigate to parent container
  const resolution = parsedMetadata?.DIF?.Data_Resolution
  if (!resolution) return false

  const targetField = 'Vertical_Resolution_Range'
  const ranges = resolution[targetField]
  if (!ranges) return false

  // Coerce structure to an array to handle single-item vs multi-item uniformly
  const isArray = Array.isArray(ranges)
  const rangeList = isArray ? ranges : [ranges]

  // Clean and prepare lookup strings
  const lookupPath = typeof correction.oldKeywordPath === 'string' ? correction.oldKeywordPath.trim() : ''

  // Strict rule: If oldKeywordPath is missing or empty, do nothing
  if (!lookupPath) return false

  // Find index of the item matching the exact value of oldKeywordPath
  const foundIndex = rangeList.findIndex((item) => {
    const itemStr = typeof item === 'string' ? item.trim() : ''

    return itemStr === lookupPath
  })

  // Target element value not found matching lookup specifications -> strictly do nothing
  if (foundIndex === -1) return false

  // --- HANDLE DELETE ACTION ---
  if (action === 'delete') {
    if (isArray) {
      ranges.splice(foundIndex, 1)
      // Only delete the field if no ranges are left, NOT the parent Data_Resolution container
      if (ranges.length === 0) {
        delete resolution[targetField]
      }
    } else {
      delete resolution[targetField]
    }

    return true
  }

  // --- HANDLE REPLACE ACTION ---
  if (action === 'replace') {
    const newVal = typeof correction.newKeywordPath === 'string' ? correction.newKeywordPath.trim() : ''

    if (isArray) {
      ranges[foundIndex] = newVal
    } else {
      resolution[targetField] = newVal
    }

    return true
  }

  return false
}
