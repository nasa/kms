import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getTotalCountQuery = ({ conceptScheme, pattern }) => {
  const safeConceptScheme = sanitizeScheme(conceptScheme)
  const safePattern = escapeSparqlString(pattern)

  const whereClause = () => {
    const conditions = ['?s rdf:type skos:Concept']
    if (safeConceptScheme) {
      conditions.push(`?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${safeConceptScheme}>`)
    }

    if (safePattern) {
      conditions.push('?s skos:prefLabel ?prefLabel')
      conditions.push(`FILTER(CONTAINS(LCASE(?prefLabel), LCASE("${safePattern}")))`)
    }

    return conditions.join(' .\n    ')
  }

  return `
  ${prefixes}
  SELECT (COUNT(DISTINCT ?s) as ?count)
  WHERE {
    ${whereClause()}
  }
  `
}
