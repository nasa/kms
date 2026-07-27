import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getTriplesForRootConceptQuery = (scheme) => {
  const safeScheme = sanitizeScheme(scheme)
  if (safeScheme === null) {
    throw new Error('Invalid scheme provided')
  }

  return `
${prefixes}
SELECT DISTINCT ?s ?p ?o
WHERE {
  ?s a skos:Concept .
  ?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> .
  ?s ?p ?o .
  FILTER NOT EXISTS { ?s skos:broader ?broader }
}
`
}
