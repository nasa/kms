import prefixes from '@/shared/constants/prefixes'

export const getSchemeUpdateCsvHeadersQuery = (schemeId, csvHeaders) => (`
  ${prefixes}
    DELETE {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> gcmd:csvHeaders ?anyHeaders .
    }
    INSERT {
      <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> gcmd:csvHeaders "${csvHeaders}" .
    }
    WHERE {
      # <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> a skos:ConceptScheme .
      OPTIONAL {
        <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}> gcmd:csvHeaders ?anyHeaders .
      }
    }
  `)
