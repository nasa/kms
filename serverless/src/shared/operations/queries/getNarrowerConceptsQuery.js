export const getNarrowerConceptsQuery = (scheme) => `
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  SELECT ?subject ?prefLabel ?narrower ?narrowerPrefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ?subject skos:narrower ?narrower .
    ?narrower skos:prefLabel ?narrowerPrefLabel .
    ${scheme ? `
    ?subject skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .
    ` : ''}
  }
`
