import { splitKeywordPath } from '../splitKeywordPath'

const PROVIDER_FIELDS = ['Short_Name', 'Long_Name']

/**
 * Applies Provider (Organization) corrections directly to the parsedMetadata object.
 * Path: DIF.Organization.Organization_Name
 */
export const applyProviderCorrection = async (parsedMetadata, correction) => {
  const action = String(correction.action || 'replace').toLowerCase()
  const ummPath = correction.ummPath || []

  // Find the numeric index (e.g., ['DataCenters', 0])
  const index = ummPath.find((part) => typeof part === 'number')

  if (typeof index !== 'number') return false

  const organizations = parsedMetadata?.DIF?.Organization
  if (!organizations) return false

  // Determine target organization block
  let targetOrg = null
  if (Array.isArray(organizations)) {
    if (index >= 0 && index < organizations.length) {
      targetOrg = organizations[index]
    }
  } else if (index === 0) {
    targetOrg = organizations
  }

  if (!targetOrg) return false

  // Ensure Organization_Name exists for replacement
  if (!targetOrg.Organization_Name && action === 'replace') {
    targetOrg.Organization_Name = {}
  }

  const target = targetOrg.Organization_Name

  if (action === 'delete') {
    const parent = parsedMetadata.DIF
    if (Array.isArray(parent.Organization)) {
      parent.Organization.splice(index, 1)
      // Cleanup: if array is empty, remove key; if one item remains, keep as array
      if (parent.Organization.length === 0) {
        delete parent.Organization
      }
    } else {
      delete parent.Organization
    }

    return true
  }

  if (action === 'replace') {
    const segments = splitKeywordPath(correction.newKeywordPath)

    // Updated Provider mapping:
    // 1. The last segment of the path is the Short_Name
    // 2. The Long_Name is provided specifically by the newLongName parameter
    const normalizedSegments = [
      segments[segments.length - 1], // Short_Name
      correction.newLongName // Long_Name
    ]

    PROVIDER_FIELDS.forEach((field, i) => {
      const val = normalizedSegments[i]
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
