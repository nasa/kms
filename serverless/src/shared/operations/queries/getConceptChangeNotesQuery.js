export const getConceptChangeNotesQuery = (scheme) => {
  let schemeFilter = ''
  if (scheme) {
    schemeFilter = `?concept <http://www.w3.org/2004/02/skos/core#inScheme> <${scheme}> .`
  }

  return `
    SELECT DISTINCT ?concept ?p ?changeNote
WHERE {
  ?concept a <http://www.w3.org/2004/02/skos/core#Concept> .
  ?concept <http://www.w3.org/2004/02/skos/core#changeNote> ?changeNote .
  ${schemeFilter}
  BIND(<http://www.w3.org/2004/02/skos/core#changeNote> AS ?p)
}
  `
}
