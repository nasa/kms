import prefixes from '@/shared/constants/prefixes'

export const getLongNamesQuery = (scheme) => `
  ${prefixes}
  SELECT ?subject ?longName
  WHERE {
    ?subject skos:inScheme ?schemeUri .
    FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}>)))
    ?subject gcmd:altLabel ?blankNode .
    ?blankNode gcmd:category "primary"@en .
    ?blankNode gcmd:text ?longName .
  }
`
