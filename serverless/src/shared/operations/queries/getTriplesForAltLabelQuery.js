import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getTriplesForAltLabelQuery = ({ altLabel, scheme }) => {
  const safeAltLabel = escapeSparqlString(altLabel)
  if (altLabel) {
    if (!safeAltLabel) {
      throw new Error('Invalid altLabel provided')
    }
  }

  const safeScheme = sanitizeScheme(scheme)
  if (safeScheme === null) {
    throw new Error('Invalid scheme provided')
  }

  return `
${prefixes}
SELECT DISTINCT ?s ?p ?o
WHERE {
  {
    SELECT DISTINCT ?concept
    WHERE {
      {
        ?concept gcmd:altLabel ?altLabel .
        ?altLabel gcmd:text "${safeAltLabel}"@en .
        ${safeScheme ? `?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> .` : ''}
      }
      UNION
      {
        ?concept skos:altLabel "${safeAltLabel}"@en .
        ${safeScheme ? `?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeScheme}> .` : ''}
      }
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
