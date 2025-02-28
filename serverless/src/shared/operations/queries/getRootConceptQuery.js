export const getRootConceptQuery = (scheme) => `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?subject ?prefLabel
    WHERE {
      ?subject skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .
      ?subject skos:prefLabel ?prefLabel
      FILTER NOT EXISTS {
        ?subject skos:broader ?broaderConcept .
      }
    }
  `
