import prefixes from '@/shared/constants/prefixes'

export const getUpdatePrefLabelQuery = (conceptId, prefLabel) => (`
  ${prefixes}
  DELETE {
    <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> skos:prefLabel ?oldLabel .
  }
  INSERT {
    <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> skos:prefLabel "${prefLabel}"@en .
  }
  WHERE {
    OPTIONAL { <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> skos:prefLabel ?oldLabel . }
  }
`)
