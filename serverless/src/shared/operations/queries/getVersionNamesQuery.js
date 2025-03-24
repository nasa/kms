export const getVersionNamesQuery = () => `
PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
PREFIX dcterms: <http://purl.org/dc/terms/>
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
