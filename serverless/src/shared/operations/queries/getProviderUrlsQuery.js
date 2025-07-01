import prefixes from '@/shared/constants/prefixes'

export const getProviderUrlsQuery = (scheme) => `
  ${prefixes}
    SELECT ?subject ?bp ?bo
    WHERE {
      ?subject skos:inScheme ?schemeUri .
      FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}>)))
      ?subject gcmd:resource ?blankNode .
      ?blankNode ?bp ?bo
    }
`
