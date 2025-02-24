export const getRootConceptsQuery = () => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT DISTINCT ?s ?p ?o
WHERE {
  {
    ?s rdf:type skos:Concept .
    FILTER NOT EXISTS { ?s skos:broader ?broader }
    ?s ?p ?o .
  }
  UNION
  {
    ?s rdf:type skos:Concept .
    FILTER NOT EXISTS { ?s skos:broader ?broader }
    ?s ?p1 ?o1 .
    ?o1 ?p ?o .
    FILTER(isBlank(?o1))
  }
}
`
