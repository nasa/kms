import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getNarrowerConceptsQuery = (scheme) => {
  let safeScheme = ''
  if (scheme) {
    safeScheme = sanitizeScheme(scheme)
    if (!safeScheme) {
      throw new Error('Invalid scheme provided')
    }
  }

  return `
  ${prefixes}
  SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ?subject skos:narrower ?narrower .
    ?narrower skos:prefLabel ?narrowerPrefLabel .
    ${safeScheme ? `
    ?subject skos:inScheme ?schemeUri .
    FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}>)))
    ` : ''}
  }
`
}
