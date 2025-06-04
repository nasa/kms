import prefixes from '@/shared/constants/prefixes'

export const getDeleteTriplesForSchemeQuery = (schemeIRI) => `
${prefixes}
DELETE {
  ?s ?p ?o .
}
WHERE {
   ?s ?p ?o .
    FILTER(?s = <${schemeIRI}>)
}
`
