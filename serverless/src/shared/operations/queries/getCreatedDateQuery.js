import prefixes from '@/shared/constants/prefixes'

export const getCreateDateQuery = (conceptId) => (`
  ${prefixes}
    SELECT ?created
    WHERE {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:created ?created .
    }
  `)
