import prefixes from '@/shared/constants/prefixes'

export const getConceptsQuery = (conceptScheme, pattern, limit = 1000, offset = 0) => `
${prefixes}
SELECT ?bn ?bp ?bo ?s ?p ?o 
WHERE {
  {
    SELECT DISTINCT ?s
    WHERE {
      ?s a skos:Concept .
      ${conceptScheme ? `?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${conceptScheme}> .` : ''}
      ${pattern ? `
      ?s skos:prefLabel ?prefLabel .
      FILTER(CONTAINS(LCASE(?prefLabel), LCASE("${pattern}")))
      ` : ''}
    }
    ORDER BY ?s
    LIMIT ${limit}
    OFFSET ${offset}
  }
  { ?s ?p ?o }
  OPTIONAL {
      BIND(?o AS ?bn) .
      ?s ?p ?bn .
      FILTER(isBlank(?bn))
      ?bn ?bp ?bo .
      # limit blank node traversal depth
      FILTER(?bn != ?bo) 
    }
  }
`
