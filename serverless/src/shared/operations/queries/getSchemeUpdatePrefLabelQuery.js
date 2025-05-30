import prefixes from '@/shared/constants/prefixes'

export const getSchemeUpdatePrefLabelQuery = (schemeId, prefLabel) => (`
  ${prefixes}
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> skos:prefLabel ?oldLabel .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> skos:prefLabel "${prefLabel}" .
    }
    WHERE {
      # <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> a skos:ConceptScheme .
      OPTIONAL {
        <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> skos:prefLabel ?oldLabel .
      }
    }
  `)
