import prefixes from '@/shared/constants/prefixes'

export const getConceptDetailsQuery = (uris) => {
  const uriList = uris.map((uri) => `<${uri}>`).join('\n')

  const directPattern = `
    VALUES ?s { ${uriList} }
    ?s ?p ?o .
  `

  const blankNodePattern = `
    VALUES ?original { ${uriList} }
    ?original ?p1 ?s .
    ?s ?p ?o .
    FILTER(isBlank(?s))
  `

  return `
  ${prefixes}
  SELECT DISTINCT ?s ?p ?o
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
