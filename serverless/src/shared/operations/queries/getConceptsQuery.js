import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getConceptsQuery = (conceptScheme, pattern, limit = 1000, offset = 0) => {
  const safeConceptScheme = sanitizeScheme(conceptScheme)
  if (conceptScheme) {
    if (!safeConceptScheme) {
      throw new Error('Invalid scheme provided')
    }
  }

  const safePattern = escapeSparqlString(pattern)
  if (pattern) {
    if (!safePattern) {
      throw new Error('Invalid pattern provided')
    }
  }

  return `
${prefixes}
SELECT ?bn ?bp ?bo ?s ?p ?o 
WHERE {
  {
    SELECT DISTINCT ?s
    WHERE {
      ?s a skos:Concept .
      ${safeConceptScheme ? `?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeConceptScheme}> .` : ''}
      ${safePattern ? `
      ?s skos:prefLabel ?prefLabel .
      FILTER(CONTAINS(LCASE(?prefLabel), LCASE("${safePattern}")))
      ` : ''}
    }
    ORDER BY ?s
    LIMIT ${limit}
    OFFSET ${offset}
  }
  { ?s ?p ?o }
  OPTIONAL {
      BIND(?o AS ?bn) .
      ?s ?p ?bn .
      FILTER(isBlank(?bn))
      ?bn ?bp ?bo .
      # limit blank node traversal depth
      FILTER(?bn != ?bo) 
    }
  }
`
}
