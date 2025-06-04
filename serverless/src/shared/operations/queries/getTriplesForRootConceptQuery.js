import prefixes from '@/shared/constants/prefixes'

export const getTriplesForRootConceptQuery = (schemeId) => `
${prefixes}
SELECT DISTINCT ?s ?p ?o
WHERE {
  ?s a skos:Concept .
  ?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> .
  ?s ?p ?o .
  FILTER NOT EXISTS { ?s skos:broader ?broader }
}
`
