import { splitKeywordPath } from '../splitKeywordPath'

const CHRONO_FIELDS = [
  'Eon',
  'Era',
  'Period',
  'Epoch',
  'Stage',
  'Detailed_Classification'
]

/**
 * Normalizes an XML Chronostratigraphic Unit object into an array of clean, populated string segments.
 * Handles potential fast-xml-parser object leaves and clears trailing empty tags.
 */
const getNormalizedChronoSegments = (chronoObj) => {
  if (!chronoObj) return []

  return CHRONO_FIELDS
    .map((field) => {
      const val = chronoObj[field]
      if (typeof val === 'object' && val !== null) {
        return val['#text'] || ''
      }

      return val
    })
    .map((val) => ((val && typeof val === 'string') ? val.trim() : ''))
    .filter((val) => val.length > 0)
}

/**
 * Applies Chrono Unit corrections directly to the parsedMetadata object via value-based lookup.
 * Path: DIF.Temporal_Coverage.Paleo_DateTime.Chronostratigraphic_Unit
 */
export const applyChronoUnitCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()

  // Navigate the nested DIF structure
  const paleo = parsedMetadata?.DIF?.Temporal_Coverage?.Paleo_DateTime
  const units = paleo?.Chronostratigraphic_Unit
  if (!units) return false

  // Coerce structure to an array to cleanly manage single-item vs multi-item nodes uniformly
  const isArray = Array.isArray(units)
  const unitList = isArray ? units : [units]

  let foundIndex = -1

  // Normalize the lookup path string safely
  const lookupPath = typeof correction.oldKeywordPath === 'string' ? correction.oldKeywordPath : ''
  const parsedOldSegments = splitKeywordPath(lookupPath)
  const oldSegments = parsedOldSegments
    .map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))
    .filter((segment) => segment.length > 0)

  if (oldSegments.length > 0) {
    const oldPathJoined = oldSegments.join(' > ')

    // Scan the metadata list for an exact structural path match
    foundIndex = unitList.findIndex((unit) => {
      const currentSegments = getNormalizedChronoSegments(unit)
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
      paleo.Chronostratigraphic_Unit.splice(foundIndex, 1)
      if (paleo.Chronostratigraphic_Unit.length === 0) {
        delete paleo.Chronostratigraphic_Unit
      }
    } else {
      delete paleo.Chronostratigraphic_Unit
    }

    return true
  }

  // --- HANDLE REPLACE ACTION ---
  if (action === 'replace') {
    const target = isArray
      ? paleo.Chronostratigraphic_Unit[foundIndex]
      : paleo.Chronostratigraphic_Unit

    // Parse out new structural path specifications safely
    const targetNewPath = typeof correction.newKeywordPath === 'string' ? correction.newKeywordPath : ''
    const parsedNewSegments = splitKeywordPath(targetNewPath)
    const newSegments = parsedNewSegments.map((segment) => ((segment && typeof segment === 'string') ? segment.trim() : ''))

    // Overwrite fields sequentially matching hierarchy positions
    CHRONO_FIELDS.forEach((field, i) => {
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
