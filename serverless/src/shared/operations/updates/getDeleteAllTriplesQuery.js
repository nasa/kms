export const getDeleteAllTriplesQuery = () => `
  DELETE {
    ?s ?p ?o
  }
  WHERE {
    ?s ?p ?o
  }
`
