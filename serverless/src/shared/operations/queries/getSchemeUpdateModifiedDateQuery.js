import prefixes from '@/shared/constants/prefixes'

export const getSchemeUpdateModifiedDateQuery = (schemeId, date) => (`
  ${prefixes}
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> dcterms:modified ?oldDate .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> dcterms:modified "${date}"^^xsd:date .
    }
    WHERE {
      OPTIONAL {
        <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> dcterms:modified ?oldDate .
      }
    }
  `)
