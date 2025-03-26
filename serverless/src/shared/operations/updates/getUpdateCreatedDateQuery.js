import prefixes from '@/shared/constants/prefixes'

export const getUpdateCreatedDateQuery = (conceptId, date) => (`
  ${prefixes}
  
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:created ?oldDate .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:created "${date}"^^xsd:date .
    }
    WHERE {
      OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:created ?oldDate . }
    }
  `)
