import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getSchemeUpdateModifiedDateQuery = (schemeId, date) => {
  const safeScheme = sanitizeScheme(schemeId)
  if (!safeScheme) {
    throw new Error('Invalid schemeId provided')
  }

  const safeDate = escapeSparqlString(date)
  if (!safeDate) {
    throw new Error('Invalid date provided')
  }

  return `
  ${prefixes}
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> dcterms:modified ?oldDate .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> dcterms:modified "${safeDate}"^^xsd:date .
    }
    WHERE {
      OPTIONAL {
        <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> dcterms:modified ?oldDate .
      }
    }
  `
}
