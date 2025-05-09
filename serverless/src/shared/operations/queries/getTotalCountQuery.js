import prefixes from '@/shared/constants/prefixes'

export const getTotalCountQuery = ({ conceptScheme, pattern }) => {
  const whereClause = () => {
    const conditions = ['?s rdf:type skos:Concept']
    if (conceptScheme) {
      conditions.push(`?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${conceptScheme}>`)
    }

    if (pattern) {
      conditions.push('?s skos:prefLabel ?prefLabel')
      conditions.push(`FILTER(CONTAINS(LCASE(?prefLabel), LCASE("${pattern}")))`)
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
