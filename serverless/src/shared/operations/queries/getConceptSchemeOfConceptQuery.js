import prefixes from '@/shared/constants/prefixes'

export const getConceptSchemeOfConceptQuery = (conceptUri) => `
  ${prefixes}
SELECT ?scheme
WHERE {
  <${conceptUri}> skos:inScheme ?scheme .
}
LIMIT 1
`
