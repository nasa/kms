import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'

export const getConceptSchemeOfConceptQuery = (conceptIRI) => {
  const safeConceptIRI = sanitizeConceptIRI(conceptIRI)
  if (safeConceptIRI === null) {
    throw new Error('Invalid conceptIRI provided')
  }

  return `
  ${prefixes}
SELECT ?scheme
WHERE {
  <${safeConceptIRI}> skos:inScheme ?scheme .
}
LIMIT 1
`
}
