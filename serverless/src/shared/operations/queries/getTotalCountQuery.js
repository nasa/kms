import prefixes from '@/shared/constants/prefixes'
import { escapeSparqlString } from '@/shared/escapeSparqlString'
import { sanitizeScheme } from '@/shared/sanitizeScheme'

export const getTotalCountQuery = ({ conceptScheme, pattern }) => {
  let safeConceptScheme = ''
  if (conceptScheme) {
    safeConceptScheme = sanitizeScheme(conceptScheme)
    if (!safeConceptScheme) {
      throw new Error('Invalid conceptScheme provided')
    }
  }

  let safePattern = ''
  if (pattern) {
    safePattern = escapeSparqlString(pattern)
    if (!safePattern) {
      throw new Error('Invalid pattern provided')
    }
  }

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
