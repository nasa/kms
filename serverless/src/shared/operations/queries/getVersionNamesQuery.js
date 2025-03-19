export const getVersionNamesQuery = () => `
PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT DISTINCT ?versionName
WHERE {
  GRAPH ?graph {
    ?version a gcmd:Version ;
             dcterms:created ?creationDate ;
             gcmd:versionName ?versionName ;
             gcmd:versionType ?versionType .
  }
}
ORDER BY DESC(?creationDate)
`
