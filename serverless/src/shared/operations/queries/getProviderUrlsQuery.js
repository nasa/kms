import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getProviderUrlsQuery = (scheme) => {
  const safeScheme = sanitizeScheme(scheme)
  if (safeScheme === null) {
    throw new Error('Invalid scheme provided')
  }

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
