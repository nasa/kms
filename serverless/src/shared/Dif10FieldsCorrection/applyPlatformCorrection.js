import { splitKeywordPath } from '../splitKeywordPath'

const PLATFORM_FIELDS = ['Type', 'Short_Name', 'Long_Name']

/**
 * Applies Platform corrections directly to the parsedMetadata object.
 * Path: DIF.Platform
 * Returns true if updated, false otherwise.
 */
export const applyPlatformCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index (e.g., ['Platforms', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const platforms = parsedMetadata?.DIF?.Platform
  if (!platforms) return false

  // Determine target without nested ternaries
  let target = null
  if (Array.isArray(platforms)) {
    if (index >= 0 && index < platforms.length) {
      target = platforms[index]
    }
  } else if (index === 0) {
    target = platforms
  }

  if (!target) return false

  if (action === 'delete') {
    const parent = parsedMetadata.DIF
    if (Array.isArray(parent.Platform)) {
      parent.Platform.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (parent.Platform.length === 0) {
        delete parent.Platform
      }
    } else {
      delete parent.Platform
    }

    return true
  }

  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    // Platform specific logic based on A > B > C > D structure:
    // index 1 (B) is 'Type'
    // index 3 (D) is 'Short_Name'
    // Long_Name is set by newLongName
    const normalizedSegments = [
      segments[1], // Type (B)
      segments[3], // Short_Name (D)
      correction.newLongName // Long_Name (provided parameter)
    ]

    PLATFORM_FIELDS.forEach((field, i) => {
      const val = normalizedSegments[i]

      // If the segment exists and isn't just whitespace, update the field
      if (val && typeof val === 'string' && val.trim().length > 0) {
        target[field] = val
      } else {
        // This handles the requested coverage for deleting the field
        // if no value is provided (e.g. empty newLongName)
        delete target[field]
      }
    })

    return true
  }

  return false
}
