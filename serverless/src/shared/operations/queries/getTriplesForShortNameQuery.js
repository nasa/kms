export const getTriplesForShortNameQuery = ({ shortName, scheme }) => `
PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT DISTINCT ?s ?p ?o
WHERE {
  {
    SELECT DISTINCT ?concept
    WHERE {
      ?concept gcmd:altLabel ?altLabel .
      ?altLabel gcmd:category "primary"@en ;
               gcmd:text "${shortName}"@en .
      ${scheme ? `?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .` : ''}
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
