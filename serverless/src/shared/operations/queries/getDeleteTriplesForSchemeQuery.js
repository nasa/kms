import prefixes from '@/shared/constants/prefixes'
import { sanitizeSchemeIRI } from '@/shared/sanitizeSchemeIRI'

export const getDeleteTriplesForSchemeQuery = (schemeIRI) => {
  const safeSchemeIRI = sanitizeSchemeIRI(schemeIRI)
  if (!safeSchemeIRI) {
    throw new Error('Invalid schemeIRI provided')
  }

  return `
${prefixes}
DELETE {
  ?s ?p ?o .
}
WHERE {
   ?s ?p ?o .
    FILTER(?s = <${safeSchemeIRI}>)
}
`
}
