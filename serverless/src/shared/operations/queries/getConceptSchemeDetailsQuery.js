import { prefixes } from '../../constants/prefixes'

export const getConceptSchemeDetailsQuery = (schemeName) => `
${prefixes}

SELECT ?scheme ?prefLabel ?notation ?modified ?created ?csvHeaders
WHERE {
  ?scheme a skos:ConceptScheme ;
          skos:prefLabel ?prefLabel ;
          skos:notation ?notation ;
          dcterms:modified ?modified .
  OPTIONAL { ?scheme dcterms:created ?created }
  OPTIONAL { ?scheme gcmd:csvHeaders ?csvHeaders }
  ${schemeName ? `FILTER(?notation = "${schemeName}")` : ''}
}
`
