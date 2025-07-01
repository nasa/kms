import prefixes from '@/shared/constants/prefixes'

export const getVersionNamesQuery = () => `
${prefixes}
SELECT DISTINCT ?versionName
WHERE {
  GRAPH ?graph {
    ?version a gcmd:Version ;
             dcterms:created ?creationDate ;
             gcmd:versionName ?originalVersionName ;
             gcmd:versionType ?versionType .
    BIND(IF(?versionType = "published", "published", ?originalVersionName) AS ?versionName)
  }
}
ORDER BY DESC(?creationDate)
`
