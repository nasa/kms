import prefixes from '@/shared/constants/prefixes'

export const getUpdateModifiedDateQuery = (conceptId, date) => (`
  ${prefixes}
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:modified ?oldDate .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:modified "${date}"^^xsd:date .
    }
    WHERE {
      OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:modified ?oldDate . }
    }
  `)
