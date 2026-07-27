import { sanitizeSchemeIRI } from '@/shared/sanitizeSchemeIRI'

export const getConceptChangeNotesQuery = (schemeIRI) => {
  let schemeFilter = ''
  if (schemeIRI) {
    const safeScheme = sanitizeSchemeIRI(schemeIRI)
    if (safeScheme === null) {
      throw new Error('Invalid schemeIRI provided')
    }

    schemeFilter = `?concept <http://www.w3.org/2004/02/skos/core#inScheme> <${safeScheme}> .`
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
