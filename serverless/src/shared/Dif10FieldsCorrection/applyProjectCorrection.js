import { splitKeywordPath } from '../splitKeywordPath'

const PROJECT_FIELDS = ['Short_Name', 'Long_Name']

/**
 * Applies Project corrections directly to the parsedMetadata object.
 * Path: DIF.Project
 * Returns true if updated, false otherwise.
 */
export const applyProjectCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index (e.g., ['Projects', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const projects = parsedMetadata?.DIF?.Project
  if (!projects) return false

  // Determine target without nested ternaries
  let target = null
  if (Array.isArray(projects)) {
    if (index >= 0 && index < projects.length) {
      target = projects[index]
    }
  } else if (index === 0) {
    target = projects
  }

  if (!target) return false

  if (action === 'delete') {
    const parent = parsedMetadata.DIF
    if (Array.isArray(parent.Project)) {
      parent.Project.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (parent.Project.length === 0) {
        delete parent.Project
      }
    } else {
      delete parent.Project
    }

    return true
  }

  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    // 1. The last segment of the path is the Short_Name
    // 2. The Long_Name is provided specifically by the newLongName parameter
    const normalizedSegments = [
      segments[segments.length - 1], // Short_Name
      correction.newLongName // Long_Name
    ]

    PROJECT_FIELDS.forEach((field, i) => {
      const val = normalizedSegments[i]
      if (val && val.trim().length > 0) {
        target[field] = val
      } else {
        delete target[field]
      }
    })

    return true
  }

  return false
}
