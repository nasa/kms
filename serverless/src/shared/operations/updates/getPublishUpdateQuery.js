import prefixes from '@/shared/constants/prefixes'

export const getPublishUpdateQuery = (name, updateDate) => {
  const batchQuery = `${prefixes}

  # 1. Delete the existing published graph
  DROP SILENT GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published> ;

  # 2. Copy draft to published
  COPY <https://gcmd.earthdata.nasa.gov/kms/version/draft>
  TO <https://gcmd.earthdata.nasa.gov/kms/version/published> ;

  # 3. Update published graph version name, type, and created date
  DELETE {
    GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published> {
      <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionName ?oldName .
      <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionType ?oldType .
      <https://gcmd.earthdata.nasa.gov/kms/version_metadata> dcterms:created ?oldCreated .
    }
  }
  INSERT {
    GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published> {
      <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionName "${name}" .
      <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionType "published" .
      <https://gcmd.earthdata.nasa.gov/kms/version_metadata> dcterms:created "${updateDate}"^^xsd:dateTime .
    }
  }
  WHERE {
    GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/published> {
      OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionName ?oldName }
      OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionType ?oldType }
      OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/version_metadata> dcterms:created ?oldCreated }
    }
  }
`

  return batchQuery
}
