import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'

export const getConceptPrefLabelAndBroaderIdQuery = (conceptIRI) => {
  const safeConceptIRI = sanitizeConceptIRI(conceptIRI)
  if (safeConceptIRI === null) {
    throw new Error('Invalid conceptIRI provided')
  }

  return `
    ${prefixes}
    SELECT ?s ?prefLabel ?broader WHERE {
      <${safeConceptIRI}> skos:prefLabel ?prefLabel .
      OPTIONAL {
        <${safeConceptIRI}> skos:broader ?broader .
      }
    }
  `
}
