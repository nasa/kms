import { splitKeywordPath } from '../splitKeywordPath'

const LOCATION_FIELDS = [
  'Location_Category',
  'Location_Type',
  'Location_Subregion1',
  'Location_Subregion2',
  'Location_Subregion3'
]

/**
 * Normalizes an XML Location object into an array of clean string segments.
 * Handles potential fast-xml-parser object leaves and clears trailing empty tags.
 */
const getNormalizedLocationSegments = (locationObj) => {
  if (!locationObj) return []

  return LOCATION_FIELDS
    .map((field) => {
      const val = locationObj[field]
      if (typeof val === 'object' && val !== null) {
        return val['#text'] || ''
      }

      return val
    })
    .map((val) => ((val && typeof val === 'string') ? val.trim() : ''))
    .filter((val) => val.length > 0)
}

/**
 * Applies Location corrections directly to the parsedMetadata object via value-based lookup.
 * Path: DIF.Location
 */
export const applyLocationCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()

  // Navigate the nested DIF structure
  const locations = parsedMetadata?.DIF?.Location
  if (!locations) return false

  // Coerce structure to an array to cleanly manage single-item vs multi-item nodes uniformly
  const isArray = Array.isArray(locations)
  const locationList = isArray ? locations : [locations]

  let foundIndex = -1

  // 1. Normalize the lookup path string safely
  const lookupPath = typeof correction.oldKeywordPath === 'string' ? correction.oldKeywordPath : ''
  const parsedOldSegments = splitKeywordPath(lookupPath)
  const oldSegments = parsedOldSegments
    .map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))
    .filter((segment) => segment.length > 0)

  if (oldSegments.length > 0) {
    const oldPathJoined = oldSegments.join(' > ')

    // Scan the metadata list for an exact structural path match
    foundIndex = locationList.findIndex((loc) => {
      const currentSegments = getNormalizedLocationSegments(loc)
      if (currentSegments.length === 0) return false

      const currentPathJoined = currentSegments.join(' > ')

      return currentPathJoined === oldPathJoined
    })
  }

  // Target element not found matching lookup specifications
  if (foundIndex === -1) return false

  // --- HANDLE DELETE ACTION ---
  if (action === 'delete') {
    if (isArray) {
      parsedMetadata.DIF.Location.splice(foundIndex, 1)
      if (parsedMetadata.DIF.Location.length === 0) {
        // eslint-disable-next-line no-param-reassign
        delete parsedMetadata.DIF.Location
      }
    } else {
      // eslint-disable-next-line no-param-reassign
      delete parsedMetadata.DIF.Location
    }

    return true
  }

  // --- HANDLE REPLACE ACTION ---
  if (action === 'replace') {
    const target = isArray ? parsedMetadata.DIF.Location[foundIndex] : parsedMetadata.DIF.Location

    // Parse out new structural path specifications safely
    const targetNewPath = typeof correction.newKeywordPath === 'string' ? correction.newKeywordPath : ''
    const parsedNewSegments = splitKeywordPath(targetNewPath)
    const newSegments = parsedNewSegments.map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))

    // Overwrite fields sequentially matching hierarchy positions
    LOCATION_FIELDS.forEach((field, i) => {
      const val = newSegments[i]
      if (val && val.length > 0) {
        target[field] = val
      } else {
        // Drop any leftover older properties not required by the new path
        delete target[field]
      }
    })

    return true
  }

  return false
}
