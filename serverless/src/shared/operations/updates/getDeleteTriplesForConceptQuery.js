import prefixes from '@/shared/constants/prefixes'
import { sanitizeConceptIRI } from '@/shared/sanitizeConceptIRI'

export const getDeleteTriplesForConceptQuery = (conceptIRI) => {
  const safeConceptIRI = sanitizeConceptIRI(conceptIRI)
  if (safeConceptIRI === null) {
    throw new Error('Invalid conceptIRI provided')
  }

  return `
  ${prefixes}
  DELETE {
    ?s ?p ?o .
  }
  WHERE {
    {
      ?s ?p ?o .
      FILTER(?s = <${safeConceptIRI}>)
    }
    UNION
    {
      ?s ?p ?o .
      FILTER(?o = <${safeConceptIRI}>)
    }
  }
  `
}
