import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getRootConceptsBySchemeQuery = (scheme) => {
  const safeScheme = sanitizeScheme(scheme)

  return `
  ${prefixes}
  SELECT ?subject ?prefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ${safeScheme ? `
      ?subject skos:inScheme ?schemeUri .
      FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}>)))
    ` : ''}
    FILTER NOT EXISTS {
      ?subject skos:broader ?broaderConcept .
    }
    ${safeScheme ? '' : `
      FILTER EXISTS {
        ?subject skos:inScheme ?scheme .
      }
    `}
  }
`
}
