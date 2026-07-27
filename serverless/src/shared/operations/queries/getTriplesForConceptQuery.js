import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'

export const getTriplesForConceptQuery = (conceptIRI) => {
  const safeConceptIRI = sanitizeConceptIRI(conceptIRI)
  if (!safeConceptIRI) {
    throw new Error('Invalid conceptIRI provided')
  }

  return `
  ${prefixes}
  SELECT DISTINCT ?s ?p ?o
  WHERE {
    {
      <${safeConceptIRI}> ?p ?o .
      BIND(<${safeConceptIRI}> AS ?s)
    } 
    UNION 
    {
      <${safeConceptIRI}> ?p1 ?bnode .
      ?bnode ?p ?o .
      BIND(?bnode AS ?s)
      FILTER(isBlank(?bnode))
    }
  }
`
}
