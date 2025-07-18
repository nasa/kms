import { prefixes } from '../../constants/prefixes'

export const getConceptSchemeDetailsQuery = (schemeName) => `
${prefixes}

SELECT ?scheme ?prefLabel ?notation ?modified ?csvHeaders
WHERE {
  ?scheme a skos:ConceptScheme ;
          skos:prefLabel ?prefLabel ;
          skos:notation ?notation ;
          dcterms:modified ?modified .
  OPTIONAL { ?scheme gcmd:csvHeaders ?csvHeaders }
  ${schemeName ? `FILTER(LCASE(STR(?notation)) = LCASE("${schemeName}"))` : ''}
}
`
