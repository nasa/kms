import prefixes from '@/shared/constants/prefixes'

export const getProviderUrlsQuery = (scheme) => `
  ${prefixes}
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    SELECT ?subject ?bp ?bo
    WHERE {
      ?subject skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .
      ?subject gcmd:resource ?blankNode .
      ?blankNode ?bp ?bo
    }
`
