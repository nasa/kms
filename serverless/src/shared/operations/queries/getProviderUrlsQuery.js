import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getProviderUrlsQuery = (scheme) => {
  const safeScheme = sanitizeScheme(scheme)

  return `
  ${prefixes}
    SELECT ?subject ?bp ?bo
    WHERE {
      ?subject skos:inScheme ?schemeUri .
      FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}>)))
      ?subject gcmd:resource ?blankNode .
      ?blankNode ?bp ?bo
    }
`
}
