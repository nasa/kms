import prefixes from '@/shared/constants/prefixes'

export const getTriplesForShortNameQuery = ({ shortName, scheme }) => `
${prefixes}
SELECT DISTINCT ?s ?p ?o
WHERE {
  {
    SELECT DISTINCT ?concept
    WHERE {
      ?concept skos:prefLabel ?prefLabel .
      FILTER(LCASE(STR(?prefLabel)) = LCASE("${shortName}"))
      ${scheme ? `?concept skos:inScheme ?schemeUri . 
      FILTER(LCASE(STR(?schemeUri)) = LCASE("https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}"))` : ''}
    }
    LIMIT 1
  }
  
  {
    ?concept ?p ?o .
    BIND(?concept AS ?s)
  }
  UNION
  {
    ?concept ?p1 ?bnode .
    ?bnode ?p ?o .
    BIND(?bnode AS ?s)
    FILTER(isBlank(?bnode))
  }
}
`
