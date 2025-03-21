export const getConceptChangeNotesQuery = ({ startDate, endDate, scheme }) => {
  let schemeFilter = ''
  if (scheme) {
    schemeFilter = `?concept <http://www.w3.org/2004/02/skos/core#inScheme> <${scheme}> .`
  }

  return `
    SELECT DISTINCT ?concept ?p ?changeNote
WHERE {
  ?concept a <http://www.w3.org/2004/02/skos/core#Concept> .
  ?concept <http://purl.org/dc/terms/modified> ?modified .
  ?concept <http://www.w3.org/2004/02/skos/core#changeNote> ?changeNote .
  ${schemeFilter}
  FILTER (
    ?modified >= "${startDate}"^^xsd:string && 
    ?modified <= "${endDate}"^^xsd:string
  )
  BIND(<http://www.w3.org/2004/02/skos/core#changeNote> AS ?p)
}
  `
}
