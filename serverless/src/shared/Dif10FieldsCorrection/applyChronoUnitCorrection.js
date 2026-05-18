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
 * Applies Chrono Unit corrections directly to the parsedMetadata object.
 * Path: DIF.Temporal_Coverage.Paleo_DateTime.Chronostratigraphic_Unit
 */
export const applyChronoUnitCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  // Navigate the nested DIF structure
  const paleo = parsedMetadata?.DIF?.Temporal_Coverage?.Paleo_DateTime
  const units = paleo?.Chronostratigraphic_Unit
  if (!units) return false

  // Identify target
  let target = null
  if (Array.isArray(units)) {
    if (index >= 0 && index < units.length) {
      target = units[index]
    }
  } else if (index === 0) {
    target = units
  }

  if (!target) return false

  if (action === 'delete') {
    if (Array.isArray(paleo.Chronostratigraphic_Unit)) {
      paleo.Chronostratigraphic_Unit.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (paleo.Chronostratigraphic_Unit.length === 0) {
        delete paleo.Chronostratigraphic_Unit
      }
    } else {
      delete paleo.Chronostratigraphic_Unit
    }

    return true
  }

  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    CHRONO_FIELDS.forEach((field, i) => {
      const val = segments[i]
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
