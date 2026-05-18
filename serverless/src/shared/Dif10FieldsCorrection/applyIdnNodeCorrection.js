const IDNNODE_FIELDS = ['Short_Name', 'Long_Name']

/**
 * Applies Chrono Unit corrections directly to the parsedMetadata object.
 * Path: DIF.IDN_Node
 */
export const applyIdnnodeCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const nodes = parsedMetadata?.DIF?.IDN_Node
  if (!nodes) return false

  let target = null
  if (Array.isArray(nodes)) {
    if (index >= 0 && index < nodes.length) {
      target = nodes[index]
    }
  } else if (index === 0) {
    target = nodes
  }

  if (!target) return false

  if (action === 'delete') {
    const parent = parsedMetadata.DIF
    if (Array.isArray(parent.IDN_Node)) {
      parent.IDN_Node.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (parent.IDN_Node.length === 0) {
        delete parent.IDN_Node
      }
    } else {
      delete parent.IDN_Node
    }

    return true
  }

  if (action === 'replace') {
  // Logic: newKeywordPath is the Short_Name (single segment),
  // newLongName is the Long_Name
    const normalizedSegments = [
      correction.newKeywordPath,
      correction.newLongName
    ]

    IDNNODE_FIELDS.forEach((field, i) => {
      const val = normalizedSegments[i]
      if (val && typeof val === 'string' && val.trim().length > 0) {
        target[field] = val
      } else {
        delete target[field] // Covers the 'else' branch for field pruning
      }
    })

    return true
  }

  return false
}
