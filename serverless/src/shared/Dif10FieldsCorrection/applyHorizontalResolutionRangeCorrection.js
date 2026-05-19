export const applyHorizontalResolutionRangeCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()

  const resolution = parsedMetadata?.DIF?.Data_Resolution
  if (!resolution) return false

  const targetField = 'Horizontal_Resolution_Range'
  const ranges = resolution[targetField]
  if (!ranges) return false

  const isArray = Array.isArray(ranges)
  const rangeList = isArray ? ranges : [ranges]

  const lookupPath = typeof correction.oldKeywordPath === 'string' ? correction.oldKeywordPath.trim() : ''
  if (!lookupPath) return false

  const foundIndex = rangeList.findIndex((item) => {
    const itemStr = typeof item === 'string' ? item.trim() : ''

    return itemStr === lookupPath
  })

  if (foundIndex === -1) return false

  if (action === 'delete') {
    if (isArray) {
      ranges.splice(foundIndex, 1)
      // Only delete the field if no ranges are left, NOT the parent object
      if (ranges.length === 0) {
        delete resolution[targetField]
      }
    } else {
      delete resolution[targetField]
    }

    // REMOVED: The block that deleted the parent 'Data_Resolution' container.
    // This preserves siblings like Vertical_Resolution_Range.

    return true
  }

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
