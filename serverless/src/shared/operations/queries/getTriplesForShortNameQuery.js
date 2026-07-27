import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getTriplesForShortNameQuery = ({ shortName, scheme }) => {
  const safeShortName = escapeSparqlString(shortName)
  if (shortName) {
    if (!safeShortName) {
      throw new Error('Invalid shortName provided')
    }
  }

  let safeScheme = ''
  if (scheme) {
    safeScheme = sanitizeScheme(scheme)
    if (!safeScheme) {
      throw new Error('Invalid scheme provided')
    }
  }

  return `
${prefixes}
SELECT DISTINCT ?s ?p ?o
WHERE {
  {
    SELECT DISTINCT ?concept
    WHERE {
      ?concept skos:prefLabel ?prefLabel .
      FILTER(LCASE(STR(?prefLabel)) = LCASE("${safeShortName}"))
      ${safeScheme ? `?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> .` : ''}
    }
    LIMIT 1
  }
  
  {
    ?concept ?p ?o .
    BIND(?concept AS ?s)
  }
  UNION
  {
    ?concept ?p1 ?bnode .
    ?bnode ?p ?o .
    BIND(?bnode AS ?s)
    FILTER(isBlank(?bnode))
  }
}
`
}
