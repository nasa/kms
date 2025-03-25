import prefixes from '@/shared/constants/prefixes'

export const getTriplesForConceptQuery = (conceptIRI) => `
  ${prefixes}
  SELECT DISTINCT ?s ?p ?o
  WHERE {
    {
      <${conceptIRI}> ?p ?o .
      BIND(<${conceptIRI}> AS ?s)
    } 
    UNION 
    {
      <${conceptIRI}> ?p1 ?bnode .
      ?bnode ?p ?o .
      BIND(?bnode AS ?s)
      FILTER(isBlank(?bnode))
    }
  }
`
