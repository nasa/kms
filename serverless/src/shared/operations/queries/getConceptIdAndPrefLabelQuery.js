import prefixes from '@/shared/constants/prefixes'

export const getConceptIdAndPrefLabelQuery = () => (`
  ${prefixes}
SELECT ?concept ?prefLabel
WHERE {
  ?concept a skos:Concept ;
  skos:prefLabel ?prefLabel .
}
`)
