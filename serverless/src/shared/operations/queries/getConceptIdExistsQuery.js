import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'

export const getConceptIdExistsQuery = (conceptIRI) => {
  const safeConceptIRI = sanitizeConceptIRI(conceptIRI)
  if (!safeConceptIRI) {
    throw new Error('Invalid conceptIRI provided')
  }

  return `
  ${prefixes}
SELECT ?p ?o 
WHERE { <${safeConceptIRI}> ?p ?o } 
LIMIT 1
`
}
