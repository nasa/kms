import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

import { prefixes } from '../../constants/prefixes'

export const getConceptSchemeDetailsQuery = (schemeName) => {
  const safeSchemeName = sanitizeScheme(schemeName)

  return `
${prefixes}

SELECT ?scheme ?prefLabel ?notation ?modified ?csvHeaders
WHERE {
  ?scheme a skos:ConceptScheme ;
          skos:prefLabel ?prefLabel ;
          skos:notation ?notation ;
          dcterms:modified ?modified .
  OPTIONAL { ?scheme gcmd:csvHeaders ?csvHeaders }
  ${safeSchemeName ? `FILTER(LCASE(STR(?notation)) = LCASE("${escapeSparqlString(safeSchemeName)}"))` : ''}
}
`
}
