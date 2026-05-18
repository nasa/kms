import { splitKeywordPath } from '../splitKeywordPath'

const INSTRUMENT_FIELDS = ['Short_Name', 'Long_Name']

/**
 * Applies Instrument corrections directly to the parsedMetadata object.
 * Path: DIF.Platform.Instrument
 * Returns true if updated, false otherwise.
 */
export const applyInstrumentCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Extract indices: Platform index is usually the 1st number, Instrument index is the 2nd
  const indices = ummPath.filter((part) => typeof part === 'number')

  if (indices.length < 2) return false

  const platformIndex = indices[0]
  const instrumentIndex = indices[1]

  const platforms = parsedMetadata?.DIF?.Platform
  if (!platforms) return false

  // 1. Find the Parent Platform
  let parentPlatform = null
  if (Array.isArray(platforms)) {
    if (platformIndex >= 0 && platformIndex < platforms.length) {
      parentPlatform = platforms[platformIndex]
    }
  } else if (platformIndex === 0) {
    parentPlatform = platforms
  }

  if (!parentPlatform) return false

  // 2. Find the Target Instrument within that Platform
  const instruments = parentPlatform.Instrument
  if (!instruments) return false

  let target = null
  if (Array.isArray(instruments)) {
    if (instrumentIndex >= 0 && instrumentIndex < instruments.length) {
      target = instruments[instrumentIndex]
    }
  } else if (instrumentIndex === 0) {
    target = instruments
  }

  if (!target) return false

  // 3. Handle Delete Action
  if (action === 'delete') {
    if (Array.isArray(parentPlatform.Instrument)) {
      parentPlatform.Instrument.splice(instrumentIndex, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (parentPlatform.Instrument.length === 0) {
        delete parentPlatform.Instrument
      }
    } else {
      delete parentPlatform.Instrument
    }

    return true
  }

  // 4. Handle Replace Action
  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    // Instrument specific logic:
    // 1. The last segment of the path is the Short_Name
    // 2. The Long_Name is provided specifically by the newLongName parameter
    const normalizedSegments = [
      segments[segments.length - 1], // Short_Name (Last segment of path)
      correction.newLongName // Long_Name (Direct parameter)
    ]

    INSTRUMENT_FIELDS.forEach((field, i) => {
      const val = normalizedSegments[i]
      if (val && typeof val === 'string' && val.trim().length > 0) {
        target[field] = val
      } else {
      // This handles the coverage for 'delete target[field]'
      // if newLongName is an empty string
        delete target[field]
      }
    })

    return true
  }

  return false
}
