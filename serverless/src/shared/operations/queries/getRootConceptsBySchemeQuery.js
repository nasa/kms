import prefixes from '@/shared/constants/prefixes'

export const getRootConceptsBySchemeQuery = (scheme) => `
  ${prefixes}
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
