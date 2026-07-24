import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptId } from '@/shared/sanitizeConceptId'

export const getModifiedDateQuery = (conceptId) => {
  const safeConceptId = sanitizeConceptId(conceptId)

  return `
    ${prefixes}
    SELECT ?modified
    WHERE {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> dcterms:modified ?modified .
    }
  `
}
