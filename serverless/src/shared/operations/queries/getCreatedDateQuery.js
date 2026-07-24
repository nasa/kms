import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptId } from '@/shared/sanitizeConceptId'

export const getCreateDateQuery = (conceptId) => {
  const safeConceptId = sanitizeConceptId(conceptId)

  return `
  ${prefixes}
    SELECT ?created
    WHERE {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> dcterms:created ?created .
    }
  `
}
