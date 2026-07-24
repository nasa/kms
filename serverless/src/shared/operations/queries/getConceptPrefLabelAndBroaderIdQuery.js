import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'

export const getConceptPrefLabelAndBroaderIdQuery = (conceptIRI) => {
  const safeConceptIRI = sanitizeConceptIRI(conceptIRI)

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
