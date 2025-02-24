export const getConceptSchemeOfConceptQuery = (conceptUri) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?scheme
WHERE {
  <${conceptUri}> skos:inScheme ?scheme .
}
LIMIT 1
`
