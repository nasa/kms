import prefixes from '@/shared/constants/prefixes'

export const getDeleteRelationshipQuery = ({
  sourceUuid, targetUuids, relationship, inverseRelationship
}) => {
  const deleteDirectTriples = () => targetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}> ${relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> .`).join('\n    ')

  const deleteInverseTriples = () => targetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${inverseRelationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}> .`).join('\n    ')

  return `
  ${prefixes}
  DELETE {
    ${deleteDirectTriples()}
    ${deleteInverseTriples()}
  } 
  WHERE {
    # Empty to not filter.
  }
  `
}
