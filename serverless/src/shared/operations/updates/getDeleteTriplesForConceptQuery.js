export const getDeleteTriplesForConceptQuery = (conceptIRI) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
DELETE {
  ?s ?p ?o .
}
WHERE {
  ?s ?p ?o .
  FILTER(?s = <${conceptIRI}>)
}
`
