import { splitKeywordPath } from '../splitKeywordPath'

const LOCATION_FIELDS = [
  'Location_Category',
  'Location_Type',
  'Location_Subregion1',
  'Location_Subregion2',
  'Location_Subregion3'
]

/**
 * Applies Location corrections directly to the parsedMetadata object.
 * Path: DIF.Location
 * Returns true if updated, false otherwise.
 */
export const applyLocationCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index (e.g., ['Location', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const locations = parsedMetadata?.DIF?.Location
  if (!locations) return false

  // Determine target without nested ternaries
  let target = null
  if (Array.isArray(locations)) {
    if (index >= 0 && index < locations.length) {
      target = locations[index]
    }
  } else if (index === 0) {
    target = locations
  }

  if (!target) return false

  if (action === 'delete') {
    const parent = parsedMetadata.DIF
    if (Array.isArray(parent.Location)) {
      parent.Location.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (parent.Location.length === 0) {
        delete parent.Location
      }
    } else {
      delete parent.Location
    }

    return true
  }

  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    LOCATION_FIELDS.forEach((field, i) => {
      const val = segments[i]
      if (val && val.trim().length > 0) {
        target[field] = val
      } else {
        // Remove trailing levels to keep XML clean
        delete target[field]
      }
    })

    return true
  }

  return false
}
