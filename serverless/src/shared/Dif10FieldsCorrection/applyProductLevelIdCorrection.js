/**
 * Applies Product Level ID corrections directly to the parsedMetadata object.
 * Path: DIF.Product_Level_Id
 */
export const applyProductLevelIdCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()

  // Guard clause against missing root DIF object
  if (!parsedMetadata?.DIF) return false

  const parent = parsedMetadata.DIF

  if (action === 'delete') {
    // If the field exists, delete it and return true; otherwise return false
    if (parent.Product_Level_Id !== undefined) {
      delete parent.Product_Level_Id

      return true
    }

    return false
  }

  if (action === 'replace') {
    const newVal = correction.newKeywordPath

    if (newVal && typeof newVal === 'string' && newVal.trim().length > 0) {
      parent.Product_Level_Id = newVal

      return true
    }
  }

  return false
}
