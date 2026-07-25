import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeConceptId } from '@/shared/sanitizeConceptId'

export const getUpdatePrefLabelQuery = (conceptId, prefLabel) => {
  const safeConceptId = sanitizeConceptId(conceptId)
  const safePrefLabel = escapeSparqlString(prefLabel)

  return `
  ${prefixes}
  DELETE {
    <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> skos:prefLabel ?oldLabel .
  }
  INSERT {
    <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> skos:prefLabel "${safePrefLabel}"@en .
  }
  WHERE {
    OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/concept/${safeConceptId}> skos:prefLabel ?oldLabel . }
  }
`
}
