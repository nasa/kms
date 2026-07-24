import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getSchemeUpdateModifiedDateQuery = (schemeId, date) => {
  const safeScheme = sanitizeScheme(schemeId)

  return `
  ${prefixes}
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> dcterms:modified ?oldDate .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> dcterms:modified "${date}"^^xsd:date .
    }
    WHERE {
      OPTIONAL {
        <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> dcterms:modified ?oldDate .
      }
    }
  `
}
