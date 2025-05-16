import prefixes from '@/shared/constants/prefixes'

export const getPublishUpdateQuery = (name, updateDate, metadata) => {
  let batchQuery = `${prefixes}`

  if (metadata) {
    const { versionName } = metadata
    batchQuery += `
    # 1. Move published graph to {versionName} graph
    MOVE <https://gcmd.earthdata.nasa.gov/kms/version/published>
    TO <https://gcmd.earthdata.nasa.gov/kms/version/${versionName}> ;

    # 2. Update {versionName} graph's version type to past_published
    DELETE {
      GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/${versionName}> {
        <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionType "published"
      }
    }
    INSERT {
      GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/${versionName}> {
        <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionType "past_published"
      }
    }
    WHERE {
      GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/${versionName}> {
        <https://gcmd.earthdata.nasa.gov/kms/version_metadata> gcmd:versionType "published"
      }
    } ;
  `
  }

  batchQuery += `
  # 3. Copy draft to published
  COPY <https://gcmd.earthdata.nasa.gov/kms/version/draft>
  TO <https://gcmd.earthdata.nasa.gov/kms/version/published> ;

  # 4 & 5. Update published graph version name, type, and created date
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
