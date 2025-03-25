import prefixes from '@/shared/constants/prefixes'

export const getTriplesForAltLabelQuery = ({ altLabel, scheme }) => `
${prefixes}
SELECT DISTINCT ?s ?p ?o
WHERE {
  {
    SELECT DISTINCT ?concept
    WHERE {
      {
        ?concept gcmd:altLabel ?altLabel .
        ?altLabel gcmd:text "${altLabel}"@en .
        ${scheme ? `?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .` : ''}
      }
      UNION
      {
        ?concept skos:altLabel "${altLabel}"@en .
        ${scheme ? `?concept skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}> .` : ''}
      }
    }
    LIMIT 1
  }
  
  {
    ?concept ?p ?o .
    BIND(?concept AS ?s)
  }
  UNION
  {
    ?concept ?p1 ?bnode .
    ?bnode ?p ?o .
    BIND(?bnode AS ?s)
    FILTER(isBlank(?bnode))
  }
}
`
