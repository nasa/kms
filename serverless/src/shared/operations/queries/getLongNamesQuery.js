import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getLongNamesQuery = (scheme) => {
  const safeScheme = sanitizeScheme(scheme)
  if (!safeScheme) {
    throw new Error('Invalid scheme provided')
  }

  return `
  ${prefixes}
  SELECT ?subject ?longName
  WHERE {
    ?subject skos:inScheme ?schemeUri .
    FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}>)))
    ?subject gcmd:altLabel ?blankNode .
    ?blankNode gcmd:category "primary"@en .
    ?blankNode gcmd:text ?longName .
  }
`
}
