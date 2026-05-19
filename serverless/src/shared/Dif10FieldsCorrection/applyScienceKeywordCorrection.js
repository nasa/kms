import { splitKeywordPath } from '../splitKeywordPath'

const SCIENCE_KEYWORD_FIELDS = [
  'Category',
  'Topic',
  'Term',
  'Variable_Level_1',
  'Variable_Level_2',
  'Variable_Level_3',
  'Detailed_Variable'
]

/**
 * Normalizes an XML science keyword object into a uniform array of populated, trimmed string values.
 * Trailing empty text nodes or missing tags are skipped entirely.
 */
const getNormalizedScienceKeywordSegments = (keywordObj) => {
  if (!keywordObj) return []

  return SCIENCE_KEYWORD_FIELDS
    .map((field) => {
      const val = keywordObj[field]
      if (typeof val === 'object' && val !== null) {
        // Fallback for fast-xml-parser text nodes or empty nodes parsed as objects
        return val['#text'] || ''
      }

      return val
    })
    .map((val) => ((val && typeof val === 'string') ? val.trim() : ''))
    .filter((val) => val.length > 0) // Remove empty properties entirely
}

/**
 * Direct modification of the parsedMetadata object for Science Keywords using value-based lookups.
 * Path: DIF.Science_Keywords
 */
export const applyScienceKeywordCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()

  const keywords = parsedMetadata?.DIF?.Science_Keywords
  if (!keywords) return false

  // Coerce structure to a uniform array to cleanly manage single-item vs multi-item records uniformly
  const isArray = Array.isArray(keywords)
  const keywordList = isArray ? keywords : [keywords]

  let foundIndex = -1

  // 1. Split and clean up the old look-up path configuration string
  const lookupPath = typeof correction.oldKeywordPath === 'string' ? correction.oldKeywordPath : ''
  const parsedOldSegments = splitKeywordPath(lookupPath)
  const oldSegments = parsedOldSegments
    .map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))
    .filter((segment) => segment.length > 0)

  if (oldSegments.length > 0) {
    const oldPathJoined = oldSegments.join(' > ')

    // Scan the metadata elements for a clean string value path match
    foundIndex = keywordList.findIndex((kw) => {
      const currentSegments = getNormalizedScienceKeywordSegments(kw)
      if (currentSegments.length === 0) return false

      const currentPathJoined = currentSegments.join(' > ')

      return currentPathJoined === oldPathJoined
    })
  }

  // Target element not found matching lookup specifications
  if (foundIndex === -1) return false

  const parent = parsedMetadata.DIF

  // --- HANDLE DELETE ACTION ---
  if (action === 'delete') {
    if (isArray) {
      parent.Science_Keywords.splice(foundIndex, 1)
      if (parent.Science_Keywords.length === 0) {
        delete parent.Science_Keywords
      }
    } else {
      delete parent.Science_Keywords
    }

    return true
  }

  // --- HANDLE REPLACE ACTION ---
  if (action === 'replace') {
    const target = isArray ? parent.Science_Keywords[foundIndex] : parent.Science_Keywords

    // Parse out new values path configuration sequence safely
    const targetNewPath = typeof correction.newKeywordPath === 'string' ? correction.newKeywordPath : ''
    const parsedNewSegments = splitKeywordPath(targetNewPath)
    const newSegments = parsedNewSegments.map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))

    // Overwrite fields sequentially matching hierarchy path index values
    SCIENCE_KEYWORD_FIELDS.forEach((field, i) => {
      const val = newSegments[i]
      if (val && val.length > 0) {
        target[field] = val
      } else {
        // Drop trailing path tags no longer needed or used by the new shorter path
        delete target[field]
      }
    })

    return true
  }

  return false
}
