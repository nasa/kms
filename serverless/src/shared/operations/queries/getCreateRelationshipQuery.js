import prefixes from '@/shared/constants/prefixes'

export const getCreateRelationshipQuery = ({
  sourceUuid, targetUuids, relationship, inverseRelationship
}) => {
  const createDirectTriples = () => targetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}> ${relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> .`).join('\n    ')

  const createInverseTriples = () => targetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${inverseRelationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}> .`).join('\n    ')

  return `
  ${prefixes}
  INSERT {
    ${createDirectTriples()}
    ${createInverseTriples()}
  }
  WHERE {
    # Do not filter
  }
  `
}
