import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'

export const getConceptSchemeOfConceptQuery = (conceptIRI) => {
  const safeConceptIRI = sanitizeConceptIRI(conceptIRI)

  return `
  ${prefixes}
SELECT ?scheme
WHERE {
  <${safeConceptIRI}> skos:inScheme ?scheme .
}
LIMIT 1
`
}
