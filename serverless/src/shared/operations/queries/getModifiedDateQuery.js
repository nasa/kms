import prefixes from '@/shared/constants/prefixes'

export const getModifiedDateQuery = (conceptId) => (`
    ${prefixes}
    SELECT ?modified
    WHERE {
      <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> dcterms:modified ?modified .
    }
  `)
