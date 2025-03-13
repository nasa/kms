export const getRootConceptsBySchemeQuery = (scheme) => `
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  SELECT ?subject ?prefLabel
  WHERE {
    ?subject skos:prefLabel ?prefLabel .
    ${scheme ? `
      ?subject skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .
    ` : ''}
    FILTER NOT EXISTS {
      ?subject skos:broader ?broaderConcept .
    }
    ${scheme ? '' : `
      FILTER EXISTS {
        ?subject skos:inScheme ?scheme .
      }
    `}
  }
`
