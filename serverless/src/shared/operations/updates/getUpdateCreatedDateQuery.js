import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeConceptId } from '@/shared/sanitizeConceptId'

export const getUpdateCreatedDateQuery = (conceptId, date) => {
  const safeConceptId = sanitizeConceptId(conceptId)
  if (safeConceptId === null) {
    throw new Error('Invalid conceptId provided')
  }

  const safeDate = escapeSparqlString(date)
  if (safeDate === null) {
    throw new Error('Invalid date provided')
  }

  return `
  ${prefixes}
  
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> dcterms:created ?oldDate .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> dcterms:created "${safeDate}"^^xsd:date .
    }
    WHERE {
      OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> dcterms:created ?oldDate . }
    }
  `
}
