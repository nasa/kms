import prefixes from '@/shared/constants/prefixes'

export const getDeleteTriplesForConceptQuery = (conceptIRI) => `
${prefixes}
DELETE {
  ?s ?p ?o .
}
WHERE {
  {
    ?s ?p ?o .
    FILTER(?s = <${conceptIRI}>)
  }
  UNION
  {
    ?s ?p ?o .
    FILTER(?o = <${conceptIRI}>)
  }
}
`
