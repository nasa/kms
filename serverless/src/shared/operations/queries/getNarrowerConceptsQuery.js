import prefixes from '@/shared/constants/prefixes'

export const getNarrowerConceptsQuery = (scheme) => `
  ${prefixes}
  SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ?subject skos:narrower ?narrower .
    ?narrower skos:prefLabel ?narrowerPrefLabel .
    ${scheme ? `
    ?subject skos:inScheme ?schemeUri .
    FILTER(LCASE(STR(?schemeUri)) = LCASE(STR(<https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}>)))
    ` : ''}
  }
`
