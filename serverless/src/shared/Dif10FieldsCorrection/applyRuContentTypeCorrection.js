import { splitKeywordPath } from '../splitKeywordPath'

const RU_FIELDS = ['Type', 'Subtype']

/**
 * Normalizes an XML Related_URL Content_Type object into an array of clean string segments.
 * Handles potential fast-xml-parser object leaves and clears trailing empty tags.
 */
const getNormalizedRuSegments = (contentTypeObj) => {
  if (!contentTypeObj) return []

  return RU_FIELDS
    .map((field) => {
      const val = contentTypeObj[field]
      if (typeof val === 'object' && val !== null) {
        return val['#text'] || ''
      }

      return val
    })
    .map((val) => ((val && typeof val === 'string') ? val.trim() : ''))
}

/**
 * Applies Related URL Content Type corrections directly to the parsedMetadata object via value-based lookup.
 * Path: DIF.Related_URL.URL_Content_Type
 */
export const applyRuContentTypeCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()

  // Navigate the nested DIF structure
  const relatedUrls = parsedMetadata?.DIF?.Related_URL
  if (!relatedUrls) return false

  // Coerce structure to an array to cleanly manage single-item vs multi-item nodes uniformly
  const isArray = Array.isArray(relatedUrls)
  const urlList = isArray ? relatedUrls : [relatedUrls]

  let foundIndex = -1

  // 1. Extract raw segments (including empty fields) to preserve trailing empty slots
  const lookupPath = typeof correction.oldKeywordPath === 'string' ? correction.oldKeywordPath : ''
  const parsedOldSegments = splitKeywordPath(lookupPath)
  const rawOldSegments = parsedOldSegments.map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))

  // Extract strictly the last 2 segments of the old keyword path configuration
  const oldSegments = rawOldSegments.slice(-2)

  // Verify that we have at least one non-empty value in the targeted pair to run a lookup
  if (oldSegments.some((segment) => segment.length > 0)) {
    const oldPathJoined = oldSegments.join(' > ')

    foundIndex = urlList.findIndex((urlBlock) => {
      const contentType = urlBlock?.URL_Content_Type
      if (!contentType) return false

      const currentSegments = getNormalizedRuSegments(contentType)
      const currentPathJoined = currentSegments.join(' > ')

      return currentPathJoined === oldPathJoined
    })
  }

  // Target element not found matching lookup specifications -> strictly do nothing
  if (foundIndex === -1) return false

  // Pinpoint the specific target Related_URL block
  const targetUrlBlock = isArray
    ? parsedMetadata.DIF.Related_URL[foundIndex]
    : parsedMetadata.DIF.Related_URL

  // --- HANDLE DELETE ACTION ---
  if (action === 'delete') {
    if (targetUrlBlock.URL_Content_Type) {
      delete targetUrlBlock.URL_Content_Type
    }

    return true
  }

  // --- HANDLE REPLACE ACTION ---
  if (action === 'replace') {
    // CRITICAL FIX: Removed "Fixing a non existing element" code block.
    // If URL_Content_Type isn't already present, foundIndex would have been -1 anyway.
    const target = targetUrlBlock.URL_Content_Type
    const segments = splitKeywordPath(correction.newKeywordPath || '')
    const rawNewSegments = segments.map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))

    // Rule: Extract strictly the last 2 raw segments of the new path to build Type and Subtype
    const normalizedNewSegments = rawNewSegments.slice(-2)

    RU_FIELDS.forEach((field, i) => {
      const val = normalizedNewSegments[i]
      if (val && val.length > 0) {
        target[field] = val
      } else {
        delete target[field]
      }
    })

    if (Object.keys(target).length === 0) {
      delete targetUrlBlock.URL_Content_Type
    }

    return true
  }

  return false
}
