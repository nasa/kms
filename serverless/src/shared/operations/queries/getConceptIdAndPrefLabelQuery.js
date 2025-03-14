export const getConceptIdAndPrefLabelQuery = () => (`
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?concept ?prefLabel
WHERE {
  ?concept a skos:Concept ;
  skos:prefLabel ?prefLabel .
}
`)
