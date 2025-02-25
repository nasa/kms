export const getConceptSchemeDetailsQuery = (schemeName = null) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms/>
SELECT ?scheme ?prefLabel ?notation ?modified ?csvHeaders
WHERE {
  ?scheme a skos:ConceptScheme ;
          skos:prefLabel ?prefLabel ;
          skos:notation ?notation ;
          dcterms:modified ?modified .
  OPTIONAL { ?scheme gcmd:csvHeaders ?csvHeaders }
  ${schemeName ? `FILTER(?notation = "${schemeName}")` : ''}
}
`
