import prefixes from '@/shared/constants/prefixes'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getTriplesForRootConceptQuery = (schemeId) => {
  const safeSchemeId = sanitizeScheme(schemeId)
  if (!safeSchemeId) {
    throw new Error('Invalid schemeId provided')
  }

  return `
${prefixes}
SELECT DISTINCT ?s ?p ?o
WHERE {
  ?s a skos:Concept .
  ?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeSchemeId}> .
  ?s ?p ?o .
  FILTER NOT EXISTS { ?s skos:broader ?broader }
}
`
}
