import prefixes from '@/shared/constants/prefixes'

export const getRootConceptsQuery = () => `
${prefixes}

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
