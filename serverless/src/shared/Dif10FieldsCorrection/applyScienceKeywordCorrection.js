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
 * Direct modification of the parsedMetadata object for Science Keywords.
 * Path: DIF.Science_Keywords
 * Returns true if updated, false otherwise.
 */
export const applyScienceKeywordCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index in the path (e.g., ['ScienceKeywords', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const keywords = parsedMetadata?.DIF?.Science_Keywords
  if (!keywords) return false

  // Determine the target object without nested ternaries
  let target = null
  if (Array.isArray(keywords)) {
    if (index >= 0 && index < keywords.length) {
      target = keywords[index]
    }
  } else if (index === 0) {
    target = keywords
  }

  if (!target) return false

  if (action === 'delete') {
    const parent = parsedMetadata.DIF
    if (Array.isArray(parent.Science_Keywords)) {
      parent.Science_Keywords.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      // (fast-xml-parser handles single vs array based on config)
      if (parent.Science_Keywords.length === 0) {
        delete parent.Science_Keywords
      }
    } else {
      delete parent.Science_Keywords
    }

    return true
  }

  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    SCIENCE_KEYWORD_FIELDS.forEach((field, i) => {
      const val = segments[i]
      if (val && val.trim().length > 0) {
        target[field] = val
      } else {
        // Remove trailing XML tags not in the new path
        delete target[field]
      }
    })

    return true
  }

  return false
}
