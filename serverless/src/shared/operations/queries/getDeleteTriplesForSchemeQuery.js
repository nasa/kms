import prefixes from '@/shared/constants/prefixes'
import { sanitizeSchemeIRI } from '@/shared/sanitizeSchemeIRI'

export const getDeleteTriplesForSchemeQuery = (schemeIRI) => {
  const safeSchemeIRI = sanitizeSchemeIRI(schemeIRI)

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
