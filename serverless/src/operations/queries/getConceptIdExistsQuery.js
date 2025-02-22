export const getConceptIdExistsQuery = (conceptIRI) => `
SELECT ?p ?o 
WHERE { <${conceptIRI}> ?p ?o } 
LIMIT 1
`
