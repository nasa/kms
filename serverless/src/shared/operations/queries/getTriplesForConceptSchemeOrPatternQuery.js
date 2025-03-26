import prefixes from '@/shared/constants/prefixes'

export const getTriplesForConceptSchemeOrPatternQuery = ({ conceptScheme, pattern }) => {
  const selectClause = `
  SELECT DISTINCT ?s ?p ?o
`

  const createWhereClause = () => {
    const conditions = [
      '?s rdf:type skos:Concept' // This ensures we only get skos:Concept triples
    ]

    if (conceptScheme) {
      conditions.push(`?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${conceptScheme}>`)
    }

    if (pattern) {
      conditions.push('?s skos:prefLabel ?prefLabel')
      conditions.push(`FILTER(CONTAINS(LCASE(?prefLabel), LCASE("${pattern}")))`)
    }

    const directPattern = `
      ${conditions.join(' .\n    ')} .
      ?s ?p ?o .
    `

    const blankNodePattern = `
      ${conditions.map((c) => c.replace(/\?s/g, '?original')).join(' .\n    ')} .
      ?original ?p1 ?s .
      ?s ?p ?o .
      FILTER(isBlank(?s))
    `

    return `
    WHERE {
      {
        ${directPattern}
      }
      UNION
      {
        ${blankNodePattern}
      }
    }
  `
  }

  return `
  ${prefixes}
  ${selectClause}
  ${createWhereClause()}
`
}
