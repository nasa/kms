/**
 * Applies ISO Topic Category corrections directly to the parsedMetadata object.
 * Path: DIF.ISO_Topic_Category
 * This is a simple string field (or array of strings).
 */
export const applyIsoTopicCategoryCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index (e.g., ['ISOTopicCategories', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const categories = parsedMetadata?.DIF?.ISO_Topic_Category
  if (!categories) return false

  if (action === 'delete') {
    const parent = parsedMetadata.DIF
    if (Array.isArray(parent.ISO_Topic_Category)) {
      parent.ISO_Topic_Category.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (parent.ISO_Topic_Category.length === 0) {
        delete parent.ISO_Topic_Category
      }
    } else if (index === 0) {
      delete parent.ISO_Topic_Category
    }

    return true
  }

  if (action === 'replace') {
    const parent = parsedMetadata.DIF
    const newVal = correction.newKeywordPath

    if (Array.isArray(parent.ISO_Topic_Category)) {
      if (index >= 0 && index < parent.ISO_Topic_Category.length) {
        parent.ISO_Topic_Category[index] = newVal

        return true
      }
    } else if (index === 0) {
      parent.ISO_Topic_Category = newVal

      return true
    }
  }

  return false
}
