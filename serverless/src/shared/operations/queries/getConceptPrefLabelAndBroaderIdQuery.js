import prefixes from '@/shared/constants/prefixes'

export const getConceptPrefLabelAndBroaderIdQuery = (conceptIRI) => `
    ${prefixes}
    SELECT ?s ?prefLabel ?broader WHERE {
      <${conceptIRI}> skos:prefLabel ?prefLabel .
      OPTIONAL {
        <${conceptIRI}> skos:broader ?broader .
      }
    }
`
