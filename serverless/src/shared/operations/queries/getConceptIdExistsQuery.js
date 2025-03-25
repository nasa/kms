import prefixes from '@/shared/constants/prefixes'

export const getConceptIdExistsQuery = (conceptIRI) => `
  ${prefixes}
SELECT ?p ?o 
WHERE { <${conceptIRI}> ?p ?o } 
LIMIT 1
`
