import { splitKeywordPath } from '../splitKeywordPath'

const RU_FIELDS = ['Type', 'Subtype']

/**
 * Applies Related URL Content Type corrections directly to the parsedMetadata object.
 * Path: DIF.Related_URL.URL_Content_Type
 */
export const applyRuContentTypeCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index (e.g., ['RelatedUrls', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const relatedUrls = parsedMetadata?.DIF?.Related_URL
  if (!relatedUrls) return false

  // Determine target URL block
  let targetUrlBlock = null
  if (Array.isArray(relatedUrls)) {
    if (index >= 0 && index < relatedUrls.length) {
      targetUrlBlock = relatedUrls[index]
    }
  } else if (index === 0) {
    targetUrlBlock = relatedUrls
  }

  if (!targetUrlBlock) return false

  // Ensure the URL_Content_Type container exists for replacement
  if (!targetUrlBlock.URL_Content_Type && action === 'replace') {
    targetUrlBlock.URL_Content_Type = {}
  }

  const target = targetUrlBlock.URL_Content_Type

  if (action === 'delete') {
    delete targetUrlBlock.URL_Content_Type

    return true
  }

  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    // RU Content Type mapping: Usually the last two segments of the path
    const normalizedSegments = segments.slice(-2)

    RU_FIELDS.forEach((field, i) => {
      const val = normalizedSegments[i]
      if (val && val.trim().length > 0) {
        target[field] = val
      } else {
        delete target[field]
      }
    })

    // If both Type and Subtype were deleted, remove the parent container
    if (Object.keys(target).length === 0) {
      delete targetUrlBlock.URL_Content_Type
    }

    return true
  }

  return false
}
